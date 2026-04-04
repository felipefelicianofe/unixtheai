import { useState, useCallback, useEffect } from "react";
import { useBinanceSocket, toBinanceSymbol } from "./useBinanceSocket";
import { fetchRealPositions } from "@/lib/binanceApi";
import { supabase } from "@/integrations/supabase/client";
import type { Position } from "@/lib/tradingEngine";

export interface SMCOrderBlock {
  type: string;
  price_zone: string;
  strength: string;
  status?: "ACTIVE" | "MITIGATED";
}

export interface FairValueGap {
  direction: string;
  zone: string;
  status?: "ACTIVE" | "FILLED";
}

export interface LiquidityZone {
  type: string;
  price: number;
}

export interface RiskManagement {
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  take_profit_3: number;
  risk_reward_ratio: string;
  atr_value: number;
  risk_pct: number;
}

export interface DualScenario {
  probability_pct: number;
  entry: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  take_profit_3: number;
}

export interface AISignal {
  direction: "LONG" | "SHORT" | "NEUTRAL";
  confidence: number;
  signalStrength: number;
  reason: string;
  indicators: string[];
  loading: boolean;
  lastUpdate: number | null;
  trend: string;
  signal: string;
  // SMC / Price Action
  orderBlocks: SMCOrderBlock[];
  fairValueGaps: FairValueGap[];
  breakOfStructure: string;
  liquidityZones: LiquidityZone[];
  smcBias: string;
  // Structure
  wyckoffPhase: string;
  elliottWave: string;
  dowTheory: string;
  confluenceScore: string;
  // Key indicators
  rsi: { value: number; signal: string } | null;
  macd: { value: number; signal_line: number; histogram: number; signal: string } | null;
  adx: { value: number; trend_strength: string } | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  bollinger: { upper: number; middle: number; lower: number } | null;
  vwap: number | null;
  stochastic: { k: number; d: number } | null;
  // Risk Management
  riskManagement: RiskManagement | null;
  // Fibonacci
  fibonacci: { nearestLevel: string; nearestPrice: number; isUptrend: boolean } | null;
  // Dual Scenarios
  dualScenarios: { primary_signal: string; buy: DualScenario; sell: DualScenario } | null;
  // Harmonic Patterns
  harmonicPatterns: Array<{ pattern: string; direction: string; completion_pct: number; confidence_pct: number; prz: string }>;
  // Momentum extras
  emaCrossover: { crossed: boolean; type: string; barsAgo: number } | null;
  htfBias: string | null;
  // Institutional
  executiveSummary: string;
  warning: string;
  bestHours: string[];
  // Sentiment
  sentimentOverall: string;
  // Master verdict
  masterVerdict: string | null;
  masterQuality: number | null;
  masterWarnings: string[];
  // Counts
  buySignals: number;
  sellSignals: number;
  neutralSignals: number;
}

const EMPTY_SIGNAL: AISignal = {
  direction: "NEUTRAL",
  confidence: 0,
  signalStrength: 0,
  reason: "Aguardando análise...",
  indicators: [],
  loading: false,
  lastUpdate: null,
  trend: "",
  signal: "",
  orderBlocks: [],
  fairValueGaps: [],
  breakOfStructure: "",
  liquidityZones: [],
  smcBias: "",
  wyckoffPhase: "",
  elliottWave: "",
  dowTheory: "",
  confluenceScore: "",
  rsi: null,
  macd: null,
  adx: null,
  ema20: null,
  ema50: null,
  ema200: null,
  bollinger: null,
  vwap: null,
  stochastic: null,
  riskManagement: null,
  fibonacci: null,
  dualScenarios: null,
  harmonicPatterns: [],
  emaCrossover: null,
  htfBias: null,
  executiveSummary: "",
  warning: "",
  bestHours: [],
  sentimentOverall: "",
  masterVerdict: null,
  masterQuality: null,
  masterWarnings: [],
  buySignals: 0,
  sellSignals: 0,
  neutralSignals: 0,
};

interface UseLiveTradeEngineOptions {
  selectedAsset: string;
  isConnected: boolean;
}

function mapDirection(signal: string): "LONG" | "SHORT" | "NEUTRAL" {
  if (signal === "COMPRA") return "LONG";
  if (signal === "VENDA") return "SHORT";
  return "NEUTRAL";
}

export function useLiveTradeEngine({ selectedAsset, isConnected }: UseLiveTradeEngineOptions) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [aiSignal, setAiSignal] = useState<AISignal>(EMPTY_SIGNAL);

  const binanceSymbol = toBinanceSymbol(selectedAsset) || "btcusdt";

  const {
    ticker,
    lastKline,
    connected: wsConnected,
    connectionStatus,
    priceDirection,
  } = useBinanceSocket({ symbol: binanceSymbol, enabled: true });

  // Fetch positions
  const fetchPositions = useCallback(async () => {
    if (!isConnected) return;
    try {
      const real = await fetchRealPositions();
      setPositions(real);
    } catch (err) {
      console.error("[LiveTrade] Failed to fetch positions:", err);
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) {
      setPositions([]);
      return;
    }
    fetchPositions();
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, [isConnected, fetchPositions]);

  // AI Analysis - full professional parse
  const fetchAISignal = useCallback(async () => {
    if (!selectedAsset) return;
    setAiSignal((prev) => ({ ...prev, loading: true }));
    try {
      const { data, error } = await supabase.functions.invoke("analyze-asset", {
        body: { asset: selectedAsset, timeframe: "15m" },
      });
      if (error) throw error;

      const r = data?.result || data;
      const h = r?.header || {};
      const ti = r?.technical_indicators || {};
      const smc = r?.smc_analysis || {};
      const wegd = r?.wegd_analysis || {};
      const rm = r?.risk_management || null;
      const inst = r?.institutional_synthesis || {};
      const sent = r?.sentiment || {};
      const master = r?._master || null;
      const smcStatus = r?._smc_status || null;

      const orderBlocks = (smcStatus?.order_blocks || smc?.order_blocks || []);
      const fvgs = (smcStatus?.fair_value_gaps || smc?.fair_value_gaps || []);

      setAiSignal({
        direction: mapDirection(h.signal),
        confidence: h.final_confidence_pct || 0,
        signalStrength: h.signal_strength_pct || 0,
        reason: inst.executive_summary || "Análise concluída",
        indicators: r?.indicators || [],
        loading: false,
        lastUpdate: Date.now(),
        trend: h.trend || "",
        signal: h.signal || "",
        orderBlocks,
        fairValueGaps: fvgs,
        breakOfStructure: smc?.break_of_structure || "",
        liquidityZones: smc?.liquidity_zones || [],
        smcBias: smc?.bias || "",
        wyckoffPhase: wegd?.wyckoff_phase || "",
        elliottWave: wegd?.elliott_wave || "",
        dowTheory: wegd?.dow_theory || "",
        confluenceScore: wegd?.confluence_score || "",
        rsi: ti.rsi || null,
        macd: ti.macd || null,
        adx: ti.adx || null,
        ema20: ti.ema_20 ?? null,
        ema50: ti.ema_50 ?? null,
        ema200: ti.ema_200 ?? null,
        bollinger: ti.bollinger || null,
        vwap: ti.vwap ?? null,
        stochastic: ti.stochastic || null,
        riskManagement: rm,
        fibonacci: r?._fibonacci ? {
          nearestLevel: r._fibonacci.nearestLevel,
          nearestPrice: r._fibonacci.nearestPrice,
          isUptrend: r._fibonacci.isUptrend,
        } : null,
        dualScenarios: r?._dual_scenarios || null,
        harmonicPatterns: r?._harmonic_patterns || [],
        emaCrossover: r?._ema_crossover || null,
        htfBias: r?._htf_bias || null,
        executiveSummary: inst.executive_summary || "",
        warning: inst.warning || "",
        bestHours: inst.best_hours || [],
        sentimentOverall: sent.overall || "",
        masterVerdict: master?.verdict || null,
        masterQuality: master?.quality_score ?? null,
        masterWarnings: master?.warnings || [],
        buySignals: ti.buy_signals || 0,
        sellSignals: ti.sell_signals || 0,
        neutralSignals: ti.neutral_signals || 0,
      });
    } catch (err) {
      console.error("[LiveTrade] AI signal error:", err);
      setAiSignal((prev) => ({ ...prev, loading: false }));
    }
  }, [selectedAsset]);

  useEffect(() => {
    fetchAISignal();
    const interval = setInterval(fetchAISignal, 60_000);
    return () => clearInterval(interval);
  }, [fetchAISignal]);

  return {
    ticker,
    lastKline,
    wsConnected,
    connectionStatus,
    priceDirection,
    positions,
    aiSignal,
    fetchPositions,
    refreshAI: fetchAISignal,
    binanceSymbol,
  };
}
