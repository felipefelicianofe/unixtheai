import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// BINANCE SYMBOL & INTERVAL MAPPING
// ============================================================

function toBinanceInterval(tf: string): string {
  const map: Record<string, string> = {
    "1M": "1m", "3M": "3m", "5M": "5m", "15M": "15m", "30M": "30m",
    "1H": "1h", "2H": "2h", "4H": "4h", "6H": "6h", "8H": "8h", "12H": "12h",
    "1D": "1d", "3D": "3d", "1W": "1w",
    "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "2h": "2h", "4h": "4h", "6h": "6h", "8h": "8h", "12h": "12h",
    "1d": "1d", "3d": "3d", "1w": "1w",
  };
  return map[tf] || "1h";
}

function toBinanceSymbol(asset: string): string {
  const BINANCE_SYMBOL_MAP: Record<string, string> = {
    "BTC/USDT": "BTCUSDT", "BTC/USD": "BTCUSDT", "BTC": "BTCUSDT", "BTCUSDT": "BTCUSDT",
    "ETH/USDT": "ETHUSDT", "ETH/USD": "ETHUSDT", "ETH": "ETHUSDT", "ETHUSDT": "ETHUSDT",
    "SOL/USDT": "SOLUSDT", "SOL/USD": "SOLUSDT", "SOL": "SOLUSDT", "SOLUSDT": "SOLUSDT",
    "ADA/USDT": "ADAUSDT", "ADAUSDT": "ADAUSDT",
    "DOT/USDT": "DOTUSDT", "DOTUSDT": "DOTUSDT",
    "AVAX/USDT": "AVAXUSDT", "AVAXUSDT": "AVAXUSDT",
    "DOGE/USDT": "DOGEUSDT", "DOGEUSDT": "DOGEUSDT",
    "XRP/USDT": "XRPUSDT", "XRPUSDT": "XRPUSDT",
    "LINK/USDT": "LINKUSDT", "LINKUSDT": "LINKUSDT",
    "MATIC/USDT": "MATICUSDT", "MATICUSDT": "MATICUSDT",
    "BNB/USDT": "BNBUSDT", "BNBUSDT": "BNBUSDT",
    "ATOM/USDT": "ATOMUSDT", "ATOMUSDT": "ATOMUSDT",
    "NEAR/USDT": "NEARUSDT", "NEARUSDT": "NEARUSDT",
    "ARB/USDT": "ARBUSDT", "ARBUSDT": "ARBUSDT",
    "OP/USDT": "OPUSDT", "OPUSDT": "OPUSDT",
    "SUI/USDT": "SUIUSDT", "SUIUSDT": "SUIUSDT",
    "APT/USDT": "APTUSDT", "APTUSDT": "APTUSDT",
    "UNI/USDT": "UNIUSDT", "UNIUSDT": "UNIUSDT",
    "AAVE/USDT": "AAVEUSDT", "AAVEUSDT": "AAVEUSDT",
    "LTC/USDT": "LTCUSDT", "LTCUSDT": "LTCUSDT",
    "XAU/USD": "PAXGUSDT", "XAUUSD": "PAXGUSDT", "XAU": "PAXGUSDT", "GOLD": "PAXGUSDT",
    "PAXGUSDT": "PAXGUSDT", "PAXG/USDT": "PAXGUSDT",
  };
  const key = asset.toUpperCase().trim();
  return BINANCE_SYMBOL_MAP[key] || asset.replace(/[\/\-\s]/g, "").toUpperCase();
}

function toCoinGeckoId(symbol: string): string | null {
  const map: Record<string, string> = {
    "BTCUSDT": "bitcoin", "ETHUSDT": "ethereum", "SOLUSDT": "solana",
    "ADAUSDT": "cardano", "DOTUSDT": "polkadot", "AVAXUSDT": "avalanche-2",
    "DOGEUSDT": "dogecoin", "XRPUSDT": "ripple", "LINKUSDT": "chainlink",
    "MATICUSDT": "matic-network", "BNBUSDT": "binancecoin",
    "ATOMUSDT": "cosmos", "NEARUSDT": "near", "ARBUSDT": "arbitrum",
    "OPUSDT": "optimism", "SUIUSDT": "sui", "APTUSDT": "aptos",
    "UNIUSDT": "uniswap", "AAVEUSDT": "aave", "LTCUSDT": "litecoin",
    "PAXGUSDT": "pax-gold",
  };
  return map[symbol] || null;
}

// ============================================================
// MULTI-ENDPOINT FETCH with STICKY CACHING
// Once a working endpoint is found, reuse it for all subsequent
// calls in the same invocation — eliminates redundant retries.
// ============================================================

const BINANCE_ENDPOINTS = [
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
  "https://api.binance.com",
  "https://data-api.binance.vision",
];

let stickyEndpoint: string | null = null;

async function fetchWithFallback(path: string): Promise<Response | null> {
  // If we already found a working endpoint, try it first
  if (stickyEndpoint) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${stickyEndpoint}${path}`, {
        signal: controller.signal,
        headers: { "Cache-Control": "no-cache" },
      });
      clearTimeout(timeoutId);
      if (res.ok) return res;
      // If sticky endpoint fails, fall through to full scan
      console.warn(`[verify] Sticky endpoint ${stickyEndpoint} failed for ${path}, re-scanning...`);
      stickyEndpoint = null;
    } catch {
      console.warn(`[verify] Sticky endpoint ${stickyEndpoint} timed out, re-scanning...`);
      stickyEndpoint = null;
    }
  }

  for (const base of BINANCE_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${base}${path}`, {
        signal: controller.signal,
        headers: { "Cache-Control": "no-cache" },
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        stickyEndpoint = base; // Cache this working endpoint
        return res;
      }
      const errText = await res.text();
      if (errText.includes("restricted location")) {
        continue; // Skip silently — no verbose logging per endpoint
      }
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      return null;
    } catch {
      continue;
    }
  }
  console.warn(`[verify] All Binance endpoints failed for ${path}`);
  return null;
}

async function fetchCoinGeckoPrice(symbol: string): Promise<number | null> {
  const cgId = toCoinGeckoId(symbol);
  if (!cgId) return null;
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`);
    if (!res.ok) return null;
    const data = await res.json();
    return data[cgId]?.usd || null;
  } catch {
    return null;
  }
}

// ============================================================
// TRUE BREAKEVEN
// ============================================================

const TRUE_BREAKEVEN_FEE_RATE = 0.0012;

function calcTrueBreakeven(entryPrice: number, isLong: boolean): number {
  return isLong
    ? entryPrice * (1 + TRUE_BREAKEVEN_FEE_RATE)
    : entryPrice * (1 - TRUE_BREAKEVEN_FEE_RATE);
}

// ============================================================
// CORE VERIFICATION LOGIC
// ============================================================

interface VerificationResult {
  status: string | null;
  close_reason: string | null;
  tp1_hit_time: string | null;
  tp2_hit_time: string | null;
  tp3_hit_time: string | null;
  loss_hit_time: string | null;
  final_result_candle: any;
  current_price: number | null;
  current_price_time: string | null;
  distance_tp1_pct: number | null;
  distance_tp2_pct: number | null;
  distance_tp3_pct: number | null;
  distance_sl_pct: number | null;
  virtual_pnl_pct: number | null;
  current_stop_loss: number; // NEW: persist the trailing SL
}

function calcDistancePct(current: number, target: number, isLong: boolean): number {
  if (isLong) {
    return ((target - current) / current) * 100;
  } else {
    return ((current - target) / current) * 100;
  }
}

function calcVirtualPnl(entry: number, current: number, isLong: boolean): number {
  if (isLong) {
    return ((current - entry) / entry) * 100;
  } else {
    return ((entry - current) / entry) * 100;
  }
}

function normalizeSignal(signal: unknown): string {
  return typeof signal === "string" ? signal.trim().toUpperCase() : "";
}

function isNeutralSignal(signal: unknown): boolean {
  const s = normalizeSignal(signal);
  return s === "NEUTRO" || s === "NEUTRAL";
}

/**
 * Sequential State Machine Verification
 * 
 * FIX: Now accepts initialSL (from DB current_stop_loss) so that
 * if TP1 was already detected in a previous cycle, we start with
 * the correct trailing stop instead of re-processing from scratch.
 * 
 * Also accepts initialState to resume from where we left off.
 */
function verifyKlines(
  klines: any[],
  analysis: any,
  isLong: boolean,
  initialSL?: number,
  initialState?: "ACTIVE" | "TP1_HIT" | "TP2_HIT",
): VerificationResult {
  const {
    entry_price, stop_loss, take_profit_1, take_profit_2, take_profit_3,
  } = analysis;

  const trueBreakeven = calcTrueBreakeven(entry_price, isLong);

  // Use provided initial SL (from DB) or fall back to original
  let currentSL = initialSL ?? stop_loss;
  let tradeState: "ACTIVE" | "TP1_HIT" | "TP2_HIT" | "CLOSED" = initialState ?? "ACTIVE";

  let tp1HitTime: string | null = null;
  let tp2HitTime: string | null = null;
  let tp3HitTime: string | null = null;
  let finalStatus: string | null = null;
  let lossHitTime: string | null = null;
  let finalCandle: any = null;

  const lastKline = klines[klines.length - 1];
  const currentPrice = parseFloat(lastKline[4]);
  const currentPriceTime = new Date(lastKline[6]).toISOString();

  for (const kline of klines) {
    if (tradeState === "CLOSED") break;

    const openTime = kline[0];
    const high = parseFloat(kline[2]);
    const low = parseFloat(kline[3]);
    const close = parseFloat(kline[4]);
    const candleTime = new Date(openTime).toISOString();
    const candleData = {
      time: candleTime,
      open: parseFloat(kline[1]),
      high, low, close,
      volume: parseFloat(kline[5]),
    };

    if (isLong) {
      const slHit = low <= currentSL;
      let tpHit = false;
      let tpLevel = 0;

      if (tradeState === "ACTIVE" && high >= take_profit_1) {
        tpHit = true; tpLevel = 1;
      } else if (tradeState === "TP1_HIT" && take_profit_2 && high >= take_profit_2) {
        tpHit = true; tpLevel = 2;
      } else if (tradeState === "TP2_HIT" && take_profit_3 && high >= take_profit_3) {
        tpHit = true; tpLevel = 3;
      }

      if (slHit && tpHit) {
        const openPrice = parseFloat(kline[1]);
        const distToSL = Math.abs(openPrice - currentSL);
        const tpPrice = tpLevel === 1 ? take_profit_1 : tpLevel === 2 ? take_profit_2 : take_profit_3;
        const distToTP = Math.abs(openPrice - tpPrice);
        if (distToSL < distToTP) { tpHit = false; }
      }

      if (tpHit && !slHit) {
        if (tpLevel === 1) {
          tp1HitTime = candleTime;
          tradeState = "TP1_HIT";
          currentSL = trueBreakeven;
        } else if (tpLevel === 2) {
          tp2HitTime = candleTime;
          tradeState = "TP2_HIT";
          currentSL = take_profit_1;
        } else if (tpLevel === 3) {
          tp3HitTime = candleTime;
          tradeState = "CLOSED";
          finalStatus = "WIN_TP3";
          finalCandle = candleData;
        }
      } else if (slHit || (tpHit && slHit)) {
        if (tpHit) {
          if (tpLevel === 1) { tp1HitTime = candleTime; tradeState = "TP1_HIT"; }
          else if (tpLevel === 2) { tp2HitTime = candleTime; tradeState = "TP2_HIT"; }
        }
        if (tradeState === "TP2_HIT") { finalStatus = "WIN_TP2"; }
        else if (tradeState === "TP1_HIT") { finalStatus = "WIN_TP1"; }
        else { finalStatus = "LOSS"; lossHitTime = candleTime; }
        tradeState = "CLOSED";
        finalCandle = candleData;
      }

    } else {
      // SHORT
      const slHit = high >= currentSL;
      let tpHit = false;
      let tpLevel = 0;

      if (tradeState === "ACTIVE" && low <= take_profit_1) {
        tpHit = true; tpLevel = 1;
      } else if (tradeState === "TP1_HIT" && take_profit_2 && low <= take_profit_2) {
        tpHit = true; tpLevel = 2;
      } else if (tradeState === "TP2_HIT" && take_profit_3 && low <= take_profit_3) {
        tpHit = true; tpLevel = 3;
      }

      if (slHit && tpHit) {
        const openPrice = parseFloat(kline[1]);
        const distToSL = Math.abs(openPrice - currentSL);
        const tpPrice = tpLevel === 1 ? take_profit_1 : tpLevel === 2 ? take_profit_2 : take_profit_3;
        const distToTP = Math.abs(openPrice - tpPrice);
        if (distToSL < distToTP) { tpHit = false; }
      }

      if (tpHit && !slHit) {
        if (tpLevel === 1) {
          tp1HitTime = candleTime;
          tradeState = "TP1_HIT";
          currentSL = trueBreakeven;
        } else if (tpLevel === 2) {
          tp2HitTime = candleTime;
          tradeState = "TP2_HIT";
          currentSL = take_profit_1;
        } else if (tpLevel === 3) {
          tp3HitTime = candleTime;
          tradeState = "CLOSED";
          finalStatus = "WIN_TP3";
          finalCandle = candleData;
        }
      } else if (slHit || (tpHit && slHit)) {
        if (tpHit) {
          if (tpLevel === 1) { tp1HitTime = candleTime; tradeState = "TP1_HIT"; }
          else if (tpLevel === 2) { tp2HitTime = candleTime; tradeState = "TP2_HIT"; }
        }
        if (tradeState === "TP2_HIT") { finalStatus = "WIN_TP2"; }
        else if (tradeState === "TP1_HIT") { finalStatus = "WIN_TP1"; }
        else { finalStatus = "LOSS"; lossHitTime = candleTime; }
        tradeState = "CLOSED";
        finalCandle = candleData;
      }
    }
  }

  const distTp1 = take_profit_1 ? calcDistancePct(currentPrice, take_profit_1, isLong) : null;
  const distTp2 = take_profit_2 ? calcDistancePct(currentPrice, take_profit_2, isLong) : null;
  const distTp3 = take_profit_3 ? calcDistancePct(currentPrice, take_profit_3, isLong) : null;
  const distSl = currentSL ? calcDistancePct(currentPrice, currentSL, !isLong) : null;
  const virtualPnl = calcVirtualPnl(entry_price, currentPrice, isLong);

  let closeReason: string | null = null;
  if (finalStatus) {
    if (finalStatus === "WIN_TP3" || finalStatus === "WIN") { closeReason = "TP3"; }
    else if (finalStatus === "WIN_TP1" || finalStatus === "WIN_TP2") { closeReason = "BREAKEVEN"; }
    else if (finalStatus === "LOSS") { closeReason = "SL"; }
  }

  return {
    status: finalStatus,
    close_reason: closeReason,
    tp1_hit_time: tp1HitTime,
    tp2_hit_time: tp2HitTime,
    tp3_hit_time: tp3HitTime,
    loss_hit_time: lossHitTime,
    final_result_candle: finalCandle,
    current_price: currentPrice,
    current_price_time: currentPriceTime,
    distance_tp1_pct: distTp1 !== null ? parseFloat(distTp1.toFixed(4)) : null,
    distance_tp2_pct: distTp2 !== null ? parseFloat(distTp2.toFixed(4)) : null,
    distance_tp3_pct: distTp3 !== null ? parseFloat(distTp3.toFixed(4)) : null,
    distance_sl_pct: distSl !== null ? parseFloat(distSl.toFixed(4)) : null,
    virtual_pnl_pct: parseFloat(virtualPnl.toFixed(4)),
    current_stop_loss: currentSL,
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log("[verify] Starting forward test verification...");

    // ── Cleanup: hard-delete neutral signals older than 1 hour ──
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: deletedNeutrals, error: cleanupErr } = await supabase
      .from("auto_management_history")
      .delete()
      .in("signal", ["NEUTRO", "NEUTRAL"])
      .in("status", ["NEUTRAL", "PENDING"])
      .lt("created_at", oneHourAgo)
      .select("id");

    if (cleanupErr) {
      console.warn("[verify] Neutral cleanup error:", cleanupErr.message);
    } else {
      console.log(`[verify] Cleaned up ${deletedNeutrals?.length || 0} old neutral records`);
    }

    // Reset sticky endpoint each invocation
    stickyEndpoint = null;

    const { data: pendingAnalyses, error: fetchErr } = await supabase
      .from("auto_management_history")
      .select("*")
      .in("status", ["PENDING", "WIN_TP1", "WIN_TP2"])
      .is("deleted_at", null)
      .is("closed_at", null);

    if (fetchErr) {
      console.error("[verify] Fetch error:", fetchErr.message);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingAnalyses || pendingAnalyses.length === 0) {
      console.log("[verify] No pending analyses to verify.");
      return new Response(JSON.stringify({ message: "No pending analyses" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    // ── DEDUP GUARD ──
    const latestByAsset = new Map<string, any>();
    const duplicatesToClose: any[] = [];

    const sortedAnalyses = [...pendingAnalyses].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    for (const analysis of sortedAnalyses) {
      const isNeutral = isNeutralSignal(analysis.signal);
      if (!isNeutral && !latestByAsset.has(analysis.asset)) {
        latestByAsset.set(analysis.asset, analysis);
      } else if (!isNeutral && latestByAsset.has(analysis.asset)) {
        duplicatesToClose.push(analysis);
      }
    }

    if (duplicatesToClose.length > 0) {
      console.log(`[verify] 🧹 Found ${duplicatesToClose.length} duplicate active entries — auto-closing...`);
      for (const dup of duplicatesToClose) {
        await supabase
          .from("auto_management_history")
          .update({
            status: "NEUTRAL",
            executive_summary: `[Auto-fechado] Entrada duplicada — substituída por sinal mais recente para ${dup.asset}.`,
            last_verified_at: now,
          })
          .eq("id", dup.id);
      }
    }

    const duplicateIds = new Set(duplicatesToClose.map(d => d.id));
    const analysesToVerify = pendingAnalyses.filter((a: any) => !duplicateIds.has(a.id));

    let verified = 0;

    for (const analysis of analysesToVerify) {
      try {
        const { id, asset, timeframe, signal, entry_price, stop_loss, take_profit_1, created_at } = analysis;

        if (!entry_price || !stop_loss || !take_profit_1) {
          continue;
        }

        // TTL: expire signals older than 7 days
        const signalAgeDays = (Date.now() - new Date(created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (signalAgeDays > 7) {
          await supabase
            .from("auto_management_history")
            .update({
              status: "NEUTRAL",
              executive_summary: `[SISTEMA] Sinal expirado (TTL > 7 dias).`,
              closed_at: now,
              last_verified_at: now,
            })
            .eq("id", id);
          console.log(`[verify] ⏱️ ${id} expired (7-day TTL)`);
          verified++;
          continue;
        }

        const normalizedSig = normalizeSignal(signal);

        if (isNeutralSignal(normalizedSig)) {
          await supabase
            .from("auto_management_history")
            .update({
              status: "NEUTRAL",
              entry_price: null, stop_loss: null,
              take_profit_1: null, take_profit_2: null, take_profit_3: null,
              tp1_hit_time: null, tp2_hit_time: null, tp3_hit_time: null,
              loss_hit_time: null, final_result_candle: null,
              current_price: null, current_price_time: null,
              distance_tp1_pct: null, distance_tp2_pct: null,
              distance_tp3_pct: null, distance_sl_pct: null,
              virtual_pnl_pct: null, last_verified_at: now,
            })
            .eq("id", id);
          verified++;
          continue;
        }

        let isLong = normalizedSig === "COMPRA" || normalizedSig === "BUY" || normalizedSig === "LONG";
        let isShort = normalizedSig === "VENDA" || normalizedSig === "SELL" || normalizedSig === "SHORT";

        if (!isLong && !isShort) {
          if (take_profit_1 > entry_price) { isLong = true; }
          else if (take_profit_1 < entry_price) { isShort = true; }
          else { continue; }
        }

        // ── FIX #1 & #2: Read current_stop_loss from DB for trailing stop continuity ──
        const dbCurrentSL = analysis.current_stop_loss ?? stop_loss;

        // Determine initial state from DB status
        let initialState: "ACTIVE" | "TP1_HIT" | "TP2_HIT" = "ACTIVE";
        if (analysis.status === "WIN_TP2" || analysis.tp2_hit_at || analysis.tp2_hit_time) {
          initialState = "TP2_HIT";
        } else if (analysis.status === "WIN_TP1" || analysis.tp1_hit_at || analysis.tp1_hit_time) {
          initialState = "TP1_HIT";
        }

        const symbol = toBinanceSymbol(asset);
        const interval = toBinanceInterval(timeframe);
        const startTime = new Date(created_at).getTime();
        const endTime = Date.now();

        const path = `/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=1000`;
        const klineRes = await fetchWithFallback(path);

        let currentPrice: number | null = null;
        let klines: any[] = [];

        if (klineRes) {
          klines = await klineRes.json();
          if (!Array.isArray(klines) || klines.length === 0) {
            console.log(`[verify] No klines for ${symbol}, trying CoinGecko...`);
            currentPrice = await fetchCoinGeckoPrice(symbol);
          }
        } else {
          currentPrice = await fetchCoinGeckoPrice(symbol);
        }

        if (klines.length > 0) {
          // Full kline verification — pass DB current_stop_loss for continuity
          const result = verifyKlines(klines, analysis, isLong, dbCurrentSL, initialState);

          const updatePayload: Record<string, any> = {
            current_price: result.current_price,
            current_price_time: result.current_price_time,
            current_stop_loss: result.current_stop_loss, // FIX: PERSIST trailing SL
            distance_tp1_pct: result.distance_tp1_pct,
            distance_tp2_pct: result.distance_tp2_pct,
            distance_tp3_pct: result.distance_tp3_pct,
            distance_sl_pct: result.distance_sl_pct,
            virtual_pnl_pct: result.virtual_pnl_pct,
            last_verified_at: now,
          };

          if (result.tp1_hit_time) {
            updatePayload.tp1_hit_time = result.tp1_hit_time;
            updatePayload.tp1_hit_at = result.tp1_hit_time;
          } else if (!analysis.tp1_hit_at && !analysis.tp1_hit_time) {
            // Only reset if DB doesn't already have it
            updatePayload.tp1_hit_at = null;
            updatePayload.tp1_hit_time = null;
          }

          if (result.tp2_hit_time) {
            updatePayload.tp2_hit_time = result.tp2_hit_time;
            updatePayload.tp2_hit_at = result.tp2_hit_time;
          } else if (!analysis.tp2_hit_at && !analysis.tp2_hit_time) {
            updatePayload.tp2_hit_at = null;
            updatePayload.tp2_hit_time = null;
          }

          if (result.tp3_hit_time) updatePayload.tp3_hit_time = result.tp3_hit_time;

          if (result.status) {
            updatePayload.status = result.status;
            if (result.close_reason) updatePayload.close_reason = result.close_reason;
            if (result.status !== "PENDING") updatePayload.closed_at = now;
            if (result.loss_hit_time) updatePayload.loss_hit_time = result.loss_hit_time;
            if (result.final_result_candle) updatePayload.final_result_candle = result.final_result_candle;
          } else if (result.tp2_hit_time) {
            updatePayload.status = "WIN_TP2";
          } else if (result.tp1_hit_time) {
            updatePayload.status = "WIN_TP1";
          }

          const { error: updateErr } = await supabase
            .from("auto_management_history")
            .update(updatePayload)
            .eq("id", id);

          if (!updateErr) {
            const label = updatePayload.status || analysis.status;
            console.log(`[verify] ✅ ${symbol} ${id} → ${label} | Price: ${result.current_price} | PnL: ${result.virtual_pnl_pct}% | SL: ${result.current_stop_loss}`);
            verified++;
          }
        } else if (currentPrice !== null) {
          // ── FIX #3: CoinGecko fallback uses current_stop_loss (trailing) ──
          const effectiveSL = dbCurrentSL;
          const virtualPnl = calcVirtualPnl(entry_price, currentPrice, isLong);
          const distTp1 = take_profit_1 ? calcDistancePct(currentPrice, take_profit_1, isLong) : null;
          const distSl = effectiveSL ? calcDistancePct(currentPrice, effectiveSL, !isLong) : null;

          let fallbackStatus = analysis.status;
          let fallbackCloseReason = null;
          let fallbackClosedAt = null;
          let newCurrentSL = effectiveSL;

          if (isLong) {
            if (currentPrice <= effectiveSL) {
              if (fallbackStatus === "WIN_TP2" || initialState === "TP2_HIT") { fallbackStatus = "WIN_TP2"; fallbackCloseReason = "BREAKEVEN"; }
              else if (fallbackStatus === "WIN_TP1" || initialState === "TP1_HIT") { fallbackStatus = "WIN_TP1"; fallbackCloseReason = "BREAKEVEN"; }
              else { fallbackStatus = "LOSS"; fallbackCloseReason = "SL"; }
              fallbackClosedAt = now;
            } else if (analysis.take_profit_3 && currentPrice >= analysis.take_profit_3) {
              fallbackStatus = "WIN_TP3"; fallbackCloseReason = "TP3"; fallbackClosedAt = now;
            } else if (analysis.take_profit_2 && currentPrice >= analysis.take_profit_2 && initialState !== "TP2_HIT") {
              fallbackStatus = "WIN_TP2";
              newCurrentSL = take_profit_1; // Trailing: SL → TP1
            } else if (currentPrice >= take_profit_1 && initialState === "ACTIVE") {
              fallbackStatus = "WIN_TP1";
              newCurrentSL = calcTrueBreakeven(entry_price, true); // Trailing: SL → breakeven
            }
          } else {
            if (currentPrice >= effectiveSL) {
              if (fallbackStatus === "WIN_TP2" || initialState === "TP2_HIT") { fallbackStatus = "WIN_TP2"; fallbackCloseReason = "BREAKEVEN"; }
              else if (fallbackStatus === "WIN_TP1" || initialState === "TP1_HIT") { fallbackStatus = "WIN_TP1"; fallbackCloseReason = "BREAKEVEN"; }
              else { fallbackStatus = "LOSS"; fallbackCloseReason = "SL"; }
              fallbackClosedAt = now;
            } else if (analysis.take_profit_3 && currentPrice <= analysis.take_profit_3) {
              fallbackStatus = "WIN_TP3"; fallbackCloseReason = "TP3"; fallbackClosedAt = now;
            } else if (analysis.take_profit_2 && currentPrice <= analysis.take_profit_2 && initialState !== "TP2_HIT") {
              fallbackStatus = "WIN_TP2";
              newCurrentSL = take_profit_1;
            } else if (currentPrice <= take_profit_1 && initialState === "ACTIVE") {
              fallbackStatus = "WIN_TP1";
              newCurrentSL = calcTrueBreakeven(entry_price, false);
            }
          }

          const updatePayload: Record<string, any> = {
            current_price: currentPrice,
            current_price_time: now,
            current_stop_loss: newCurrentSL, // FIX: persist trailing SL in fallback too
            distance_tp1_pct: distTp1 !== null ? parseFloat(distTp1.toFixed(4)) : null,
            distance_sl_pct: distSl !== null ? parseFloat(distSl.toFixed(4)) : null,
            virtual_pnl_pct: parseFloat(virtualPnl.toFixed(4)),
            last_verified_at: now,
          };

          if (fallbackStatus !== analysis.status) {
            updatePayload.status = fallbackStatus;
            if (fallbackCloseReason) updatePayload.close_reason = fallbackCloseReason;
            if (fallbackClosedAt) updatePayload.closed_at = fallbackClosedAt;
          }

          const { error: updateErr } = await supabase
            .from("auto_management_history")
            .update(updatePayload)
            .eq("id", id);

          if (!updateErr) {
            console.log(`[verify] 📊 ${symbol} ${id} — CoinGecko price: $${currentPrice} | PnL: ${virtualPnl.toFixed(2)}% | SL: ${newCurrentSL}`);
            verified++;
          }
        } else {
          console.error(`[verify] ❌ ${symbol} — No data source available`);
        }

        // Reduced rate limiting (sticky cache means fewer requests)
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.error(`[verify] Error ${analysis.id}:`, err);
      }
    }

    console.log(`[verify] Done. Verified ${verified}/${analysesToVerify.length}. (${duplicatesToClose.length} duplicates closed)`);

    // ── AUTO-TRIGGER: management-auto-refine after finalizations ──
    let finalizedCount = 0;
    for (const analysis of analysesToVerify) {
      const wasOpen = ["PENDING", "WIN_TP1", "WIN_TP2"].includes(analysis.status);
      if (!wasOpen) continue;
      const { data: updated } = await supabase
        .from("auto_management_history")
        .select("status")
        .eq("id", analysis.id)
        .single();
      if (updated && ["WIN_TP1", "WIN_TP2", "WIN_TP3", "WIN", "LOSS"].includes(updated.status) && updated.status !== analysis.status) {
        finalizedCount++;
      }
    }

    if (finalizedCount > 0) {
      console.log(`[verify] 🔄 ${finalizedCount} finalized — triggering management-auto-refine...`);
      try {
        const refineUrl = `${supabaseUrl}/functions/v1/management-auto-refine`;
        await fetch(refineUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ mode: "full" }),
        });
      } catch (refineErr) {
        console.error(`[verify] management-auto-refine trigger failed:`, refineErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, verified, total: pendingAnalyses.length, finalized: finalizedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[verify] Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
