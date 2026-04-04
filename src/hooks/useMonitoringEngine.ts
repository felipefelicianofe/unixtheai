import { useState, useEffect, useRef, useCallback } from "react";
import { fetchBinancePricesBatch } from "@/lib/binanceApi";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export type SignalDirection = "LONG" | "SHORT";

export type MonitorStatus =
  | "MONITORING"
  | "SIGNAL_ACTIVE"
  | "TP1_HIT"
  | "TP2_HIT"
  | "CLOSED_SL"
  | "CLOSED_BREAKEVEN"
  | "CLOSED_TP3";

export interface ActiveSignal {
  historyId: string;
  direction: SignalDirection;
  entryPrice: number;
  stopLoss: number;
  currentStopLoss: number; // moves to breakeven after TP1
  takeProfit1: number;
  takeProfit2: number | null;
  takeProfit3: number | null;
  signalTime: string;
  signal: string; // COMPRA or VENDA
  timeframe: string;
  leverage: number;
  tp1Hit: boolean;
  tp1HitAt: string | null;
  tp2Hit: boolean;
  tp2HitAt: string | null;
  peakPnlPct: number;
}

export interface AssetMonitorState {
  asset: string;
  status: MonitorStatus;
  currentPrice: number | null;
  lastPulseAt: number;
  pulseActive: boolean;
  activeSignal: ActiveSignal | null;
  lastAnalysisAt: number | null;
  error: string | null;
  requestCount: number;
  successCount: number;
}

interface MonitorConfig {
  id: string;
  asset: string;
  timeframe: string;
  analysis_period_minutes: number;
  leverage: number;
  is_active: boolean;
}

interface SupabaseHistoryPayload {
  id: string;
  asset: string;
  signal: string;
  entry_price: number;
  stop_loss: number;
  current_stop_loss: number | null;
  take_profit_1: number;
  take_profit_2: number | null;
  take_profit_3: number | null;
  created_at: string;
  timeframe: string;
  tp1_hit_at: string | null;
  tp1_hit_time: string | null;
  tp2_hit_at: string | null;
  tp2_hit_time: string | null;
  peak_pnl_pct: number | null;
  status: string;
  auto_management_configs?: { leverage?: number } | null;
}

const POLL_INTERVAL_MS = 10_000; // 10 seconds
const PULSE_DURATION_MS = 600; // pulse glow duration
const STORAGE_KEY = "auto-management-active-signals";

// ── True Breakeven Constants ──
// Binance Futures USDT-M fees:
//   Taker: 0.05% (0.0005) per side
//   Open (Taker worst-case): 0.05% + Close (STOP_MARKET = Taker): 0.05% = 0.10%
//   Slippage buffer for STOP_MARKET: +0.02%
//   TOTAL: 0.12% (0.0012)
const TRUE_BREAKEVEN_FEE_RATE = 0.0012;

// ── Helpers ──

/**
 * Calculate True Breakeven price accounting for trading fees + slippage.
 * This ensures that a STOP_MARKET close at breakeven results in
 * zero profit/loss (not a net loss due to fees).
 *
 * Breakeven is NEVER the same as entry price.
 *   LONG:  trueBreakeven = entry × (1 + 0.0012)  → slightly ABOVE entry
 *   SHORT: trueBreakeven = entry × (1 - 0.0012)  → slightly BELOW entry
 */
function calcTrueBreakeven(
  entryPrice: number,
  direction: SignalDirection
): number {
  return direction === "LONG"
    ? entryPrice * (1 + TRUE_BREAKEVEN_FEE_RATE)
    : entryPrice * (1 - TRUE_BREAKEVEN_FEE_RATE);
}

function isTargetHit(
  currentPrice: number,
  targetPrice: number,
  direction: SignalDirection,
  isGainTarget: boolean // true for TP targets, false for SL
): boolean {
  if (direction === "LONG") {
    return isGainTarget
      ? currentPrice >= targetPrice
      : currentPrice <= targetPrice;
  } else {
    // SHORT: gain when price goes DOWN, loss when price goes UP
    return isGainTarget
      ? currentPrice <= targetPrice
      : currentPrice >= targetPrice;
  }
}

function calculatePnlPct(
  entryPrice: number,
  currentPrice: number,
  direction: SignalDirection
): number {
  if (entryPrice === 0) return 0;
  if (direction === "LONG") {
    return ((currentPrice - entryPrice) / entryPrice) * 100;
  } else {
    return ((entryPrice - currentPrice) / entryPrice) * 100;
  }
}

// ── Persist/Restore active signals ──

function persistSignals(states: Map<string, AssetMonitorState>) {
  const toSave: Record<string, { status: MonitorStatus; activeSignal: ActiveSignal }> = {};
  states.forEach((state, asset) => {
    if (state.activeSignal && state.status !== "MONITORING") {
      toSave[asset] = { status: state.status, activeSignal: state.activeSignal };
    }
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* ignore */ }
}

function restoreSignals(): Record<string, { status: MonitorStatus; activeSignal: ActiveSignal }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ── Hook ──

export function useMonitoringEngine(enabled: boolean = true) {
  const [assetStates, setAssetStates] = useState<Map<string, AssetMonitorState>>(new Map());
  const [configs, setConfigs] = useState<MonitorConfig[]>([]);
  const [engineRunning, setEngineRunning] = useState(false);
  const [totalRequests, setTotalRequests] = useState(0);
  const [totalSuccess, setTotalSuccess] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statesRef = useRef<Map<string, AssetMonitorState>>(new Map());
  const configsRef = useRef<MonitorConfig[]>([]);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Keep refs in sync
  useEffect(() => { statesRef.current = assetStates; }, [assetStates]);
  useEffect(() => { configsRef.current = configs; }, [configs]);

  // ── Fetch active configs from Supabase ──
  const fetchConfigs = useCallback(async () => {
    const { data, error } = await supabase
      .from("auto_management_configs")
      .select("*")
      .eq("is_active", true);

    if (error) {
      console.error("[MonitorEngine] Config fetch error:", error.message);
      return;
    }

    const activeConfigs: MonitorConfig[] = (data || []).map((c) => ({
      id: c.id,
      asset: c.asset,
      timeframe: c.timeframe,
      analysis_period_minutes: c.analysis_period_minutes,
      leverage: c.leverage || 1,
      is_active: c.is_active,
    }));

    setConfigs(activeConfigs);
  }, []);

  // ── Check for existing active signals from DB ──
  const loadActiveSignalsFromDB = useCallback(async (activeConfigs: MonitorConfig[]) => {
    // Query for PENDING (non-neutral) signals — these are active signals
    const assets = activeConfigs.map(c => c.asset);
    if (assets.length === 0) return;

    const { data } = await supabase
      .from("auto_management_history")
      .select("*, auto_management_configs (asset, timeframe, analysis_period_minutes, leverage)")
      .is("deleted_at", null)
      .is("closed_at", null)
      .in("status", ["PENDING", "WIN_TP1", "WIN_TP2"])
      .not("signal", "in", '("NEUTRO","NEUTRAL")')
      .in("asset", assets);

    const pendingSignals = (data as unknown) as SupabaseHistoryPayload[];
    if (!pendingSignals || pendingSignals.length === 0) return;

    // ── DEDUP: Keep only the most recent PENDING signal per asset ──
    const latestByAsset = new Map<string, SupabaseHistoryPayload>();
    for (const sig of pendingSignals) {
      const existing = latestByAsset.get(sig.asset);
      if (!existing || new Date(sig.created_at) > new Date(existing.created_at)) {
        latestByAsset.set(sig.asset, sig);
      }
    }
    const dedupedSignals = Array.from(latestByAsset.values());

    const restored = restoreSignals();
    const newStates = new Map(statesRef.current);

    for (const rawSig of dedupedSignals) {
      const sig = rawSig;
      const asset = sig.asset as string;
      const isLong = sig.signal === "COMPRA" || sig.signal === "BUY" || sig.signal === "LONG" ||
        (sig.take_profit_1 && sig.entry_price && sig.take_profit_1 > sig.entry_price);
      const direction: SignalDirection = isLong ? "LONG" : "SHORT";
      const config = activeConfigs.find(c => c.asset === asset);
      const restoredState = restored[asset];

      const activeSignal: ActiveSignal = {
        historyId: sig.id,
        direction,
        entryPrice: sig.entry_price,
        stopLoss: sig.stop_loss,
        currentStopLoss: sig.current_stop_loss || sig.stop_loss,
        takeProfit1: sig.take_profit_1,
        takeProfit2: sig.take_profit_2 || null,
        takeProfit3: sig.take_profit_3 || null,
        signalTime: sig.created_at,
        signal: sig.signal || "NEUTRO",
        timeframe: sig.timeframe,
        leverage: config?.leverage || (sig.auto_management_configs as { leverage?: number })?.leverage || 1,
        tp1Hit: !!sig.tp1_hit_at || !!sig.tp1_hit_time || restoredState?.activeSignal?.tp1Hit || false,
        tp1HitAt: sig.tp1_hit_at || sig.tp1_hit_time || restoredState?.activeSignal?.tp1HitAt || null,
        tp2Hit: !!sig.tp2_hit_at || !!sig.tp2_hit_time || restoredState?.activeSignal?.tp2Hit || false,
        tp2HitAt: sig.tp2_hit_at || sig.tp2_hit_time || restoredState?.activeSignal?.tp2HitAt || null,
        peakPnlPct: sig.peak_pnl_pct || restoredState?.activeSignal?.peakPnlPct || 0,
      };

      const status: MonitorStatus = restoredState?.status || 
        (activeSignal.tp2Hit ? "TP2_HIT" : activeSignal.tp1Hit ? "TP1_HIT" : "SIGNAL_ACTIVE");

      newStates.set(asset, {
        ...(newStates.get(asset) || {
          asset,
          currentPrice: null,
          lastPulseAt: 0,
          pulseActive: false,
          lastAnalysisAt: null,
          error: null,
          requestCount: 0,
          successCount: 0,
        }),
        status,
        activeSignal,
      });
    }

    setAssetStates(newStates);
  }, []);

  // ── Initialize configs & states ──
  useEffect(() => {
    if (!enabled) return;

    const init = async () => {
      await fetchConfigs();
    };
    init();

    // Refresh configs every 30s (new configs added, toggled, etc.)
    const configInterval = setInterval(fetchConfigs, 30_000);
    return () => clearInterval(configInterval);
  }, [enabled, fetchConfigs]);

  // ── Initialize asset states when configs change ──
  useEffect(() => {
    if (configs.length === 0) return;

    const newStates = new Map(statesRef.current);
    const activeAssets = new Set(configs.map(c => c.asset));

    // Add new assets
    for (const config of configs) {
      if (!newStates.has(config.asset)) {
        newStates.set(config.asset, {
          asset: config.asset,
          status: "MONITORING",
          currentPrice: null,
          lastPulseAt: 0,
          pulseActive: false,
          activeSignal: null,
          lastAnalysisAt: null,
          error: null,
          requestCount: 0,
          successCount: 0,
        });
      }
    }

    // Remove deactivated assets
    for (const [asset] of newStates) {
      if (!activeAssets.has(asset)) {
        newStates.delete(asset);
      }
    }

    setAssetStates(newStates);

    // Load active signals from DB
    loadActiveSignalsFromDB(configs);
  }, [configs, loadActiveSignalsFromDB]);

  // ── Close a signal (update DB + state) ──
  const closeSignal = useCallback(async (
    asset: string,
    reason: "SL" | "BREAKEVEN" | "TP3" | "MANUAL",
    closeStatus: MonitorStatus
  ) => {
    const state = statesRef.current.get(asset);
    if (!state?.activeSignal) return;

    const { historyId, peakPnlPct } = state.activeSignal;

    // Map closeStatus to DB status
    const dbStatus = reason === "SL" ? "LOSS" :
      reason === "TP3" ? "WIN_TP3" :
      reason === "BREAKEVEN" ? (state.activeSignal.tp2Hit ? "WIN_TP2" : state.activeSignal.tp1Hit ? "WIN_TP1" : "LOSS") :
      "NEUTRAL";

    try {
      await supabase
        .from("auto_management_history")
        .update({
          status: dbStatus,
          signal_status: closeStatus,
          closed_at: new Date().toISOString(),
          close_reason: reason,
          peak_pnl_pct: peakPnlPct,
          ...(state.activeSignal.tp1Hit && state.activeSignal.tp1HitAt ? { tp1_hit_time: state.activeSignal.tp1HitAt } : {}),
          ...(state.activeSignal.tp2Hit && state.activeSignal.tp2HitAt ? { tp2_hit_time: state.activeSignal.tp2HitAt } : {}),
          loss_hit_time: reason === "SL" ? new Date().toISOString() : null,
        })
        .eq("id", historyId);
    } catch (err) {
      console.error("[MonitorEngine] Close signal DB error:", err);
    }

    // Release the asset
    const newStates = new Map(statesRef.current);
    newStates.set(asset, {
      ...state,
      status: "MONITORING",
      activeSignal: null,
    });
    setAssetStates(newStates);
    persistSignals(newStates);

    console.log(`[MonitorEngine] 🔓 Signal CLOSED for ${asset}: ${reason} (${dbStatus})`);
  }, []);

  // ── Main polling tick ──
  const pollTick = useCallback(async () => {
    if (!enabledRef.current) return;
    const currentConfigs = configsRef.current;
    if (currentConfigs.length === 0) return;

    const symbols = [...new Set(currentConfigs.map(c => c.asset))];
    const prices = await fetchBinancePricesBatch(symbols);
    const now = Date.now();

    setTotalRequests(prev => prev + 1);
    if (prices.size > 0) setTotalSuccess(prev => prev + 1);

    const newStates = new Map(statesRef.current);

    for (const symbol of symbols) {
      const price = prices.get(symbol) ?? null;
      const state = newStates.get(symbol);
      if (!state) continue;

      const updated: AssetMonitorState = {
        ...state,
        currentPrice: price,
        lastPulseAt: now,
        pulseActive: true,
        requestCount: state.requestCount + 1,
        successCount: price !== null ? state.successCount + 1 : state.successCount,
        error: price === null ? "Falha ao obter preço" : null,
      };

      // ── Target checking for active signals ──
      if (price !== null && updated.activeSignal) {
        const sig = updated.activeSignal;
        const pnl = calculatePnlPct(sig.entryPrice, price, sig.direction);
        sig.peakPnlPct = Math.max(sig.peakPnlPct, pnl);

        // Update current price on DB periodically (don't spam — every 6th tick = ~60s)
        // FIX #6: Only update price/pnl fields — do NOT overwrite status fields
        // that the server-side verify-management-results may have already set
        if (updated.requestCount % 6 === 0) {
          supabase
            .from("auto_management_history")
            .update({
              current_price: price,
              virtual_pnl_pct: pnl / 100,
              peak_pnl_pct: sig.peakPnlPct,
              // NOTE: do NOT set last_verified_at here — reserve it for server-side
            })
            .eq("id", sig.historyId)
            .then(() => {});

          // FIX #6: Check if server already closed this signal
          supabase
            .from("auto_management_history")
            .select("status, closed_at, current_stop_loss")
            .eq("id", sig.historyId)
            .single()
            .then(({ data: dbRow }) => {
              if (dbRow?.closed_at) {
                // Server already closed this signal — release it client-side
                const newS = new Map(statesRef.current);
                const st = newS.get(symbol);
                if (st?.activeSignal?.historyId === sig.historyId) {
                  newS.set(symbol, { ...st, status: "MONITORING", activeSignal: null });
                  setAssetStates(newS);
                  persistSignals(newS);
                  console.log(`[MonitorEngine] 🔄 Server already closed ${symbol} (${dbRow.status}) — syncing client`);
                }
              } else if (dbRow?.current_stop_loss && dbRow.current_stop_loss !== sig.currentStopLoss) {
                // Server updated trailing stop — sync it
                sig.currentStopLoss = dbRow.current_stop_loss;
              }
            });
        }

        // Check Stop Loss
        if (isTargetHit(price, sig.currentStopLoss, sig.direction, false)) {
          if (updated.status === "TP1_HIT" || updated.status === "TP2_HIT") {
            // SL is at breakeven — close as breakeven
            await closeSignal(symbol, "BREAKEVEN", "CLOSED_BREAKEVEN");
            continue;
          } else {
            // Original SL hit
            await closeSignal(symbol, "SL", "CLOSED_SL");
            continue;
          }
        }

        // Check TP3
        if (sig.takeProfit3 && isTargetHit(price, sig.takeProfit3, sig.direction, true)) {
          await closeSignal(symbol, "TP3", "CLOSED_TP3");
          continue;
        }

        // Check TP2
        if (!sig.tp2Hit && sig.takeProfit2 && isTargetHit(price, sig.takeProfit2, sig.direction, true)) {
          sig.tp2Hit = true;
          sig.tp2HitAt = new Date().toISOString();
          updated.status = "TP2_HIT";
          // TRAILING STOP: Move SL to TP1 level after TP2 hit (lock profit)
          sig.currentStopLoss = sig.takeProfit1;
          supabase
            .from("auto_management_history")
            .update({
              signal_status: "TP2_HIT",
              tp2_hit_at: sig.tp2HitAt,
              tp2_hit_time: sig.tp2HitAt,
              current_stop_loss: sig.takeProfit1,
            })
            .eq("id", sig.historyId)
            .then(() => {});
          console.log(`[MonitorEngine] 🎯🎯 TP2 HIT for ${symbol} at ${price} — SL moved to TP1 (${sig.takeProfit1})`);
        }

        // Check TP1
        if (!sig.tp1Hit && isTargetHit(price, sig.takeProfit1, sig.direction, true)) {
          sig.tp1Hit = true;
          sig.tp1HitAt = new Date().toISOString();
          // Move SL to TRUE Breakeven (entry + fees + slippage buffer)
          // NEVER use raw entryPrice — a STOP_MARKET close at entry = net loss
          const trueBreakeven = calcTrueBreakeven(sig.entryPrice, sig.direction);
          sig.currentStopLoss = trueBreakeven;
          updated.status = "TP1_HIT";
          supabase
            .from("auto_management_history")
            .update({
              signal_status: "TP1_HIT",
              current_stop_loss: trueBreakeven,
              tp1_hit_at: sig.tp1HitAt,
              tp1_hit_time: sig.tp1HitAt,
            })
            .eq("id", sig.historyId)
            .then(() => {});
          console.log(`[MonitorEngine] 🎯 TP1 HIT for ${symbol} at ${price} — SL moved to TRUE Breakeven (${trueBreakeven.toFixed(6)}) [entry=${sig.entryPrice}, fee=${TRUE_BREAKEVEN_FEE_RATE}]`);
        }

        updated.activeSignal = { ...sig };
      }

      newStates.set(symbol, updated);
    }

    setAssetStates(newStates);
    persistSignals(newStates);

    // Turn off pulse after duration
    setTimeout(() => {
      setAssetStates(prev => {
        const next = new Map(prev);
        for (const [key, val] of next) {
          if (val.pulseActive) {
            next.set(key, { ...val, pulseActive: false });
          }
        }
        return next;
      });
    }, PULSE_DURATION_MS);
  }, [closeSignal]);

  // ── Start/Stop engine ──
  useEffect(() => {
    if (enabled && configs.length > 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setEngineRunning(true);
      // Run immediately
      pollTick();
      // Then every 10s
      intervalRef.current = setInterval(pollTick, POLL_INTERVAL_MS);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setEngineRunning(false);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, configs.length, pollTick]);

  // ── Check if asset has locked signal (by asset name, regardless of timeframe) ──
  const isAssetLocked = useCallback((asset: string): boolean => {
    const state = statesRef.current.get(asset);
    return !!state && state.status !== "MONITORING" && state.activeSignal !== null;
  }, []);

  // ── Manual close ──
  const manualClose = useCallback(async (asset: string) => {
    await closeSignal(asset, "MANUAL", "MONITORING" as MonitorStatus);
  }, [closeSignal]);

  // ── Refresh configs ──
  const refreshConfigs = useCallback(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // ── Get active signals as array ──
  const activeSignals = Array.from(assetStates.values()).filter(
    s => s.activeSignal !== null && s.status !== "MONITORING"
  );

  // ── All monitored assets as array ──
  const monitoredAssets = Array.from(assetStates.values());

  return {
    assetStates,
    monitoredAssets,
    activeSignals,
    engineRunning,
    totalRequests,
    totalSuccess,
    isAssetLocked,
    manualClose,
    refreshConfigs,
    configs,
  };
}
