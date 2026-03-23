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

// CoinGecko ID mapping for fallback
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
// MULTI-ENDPOINT FETCH (bypass geo-blocking)
// ============================================================

const BINANCE_ENDPOINTS = [
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
  "https://api.binance.com",
  "https://data-api.binance.vision",
];

async function fetchWithFallback(path: string): Promise<Response | null> {
  for (const base of BINANCE_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${base}${path}`, {
        signal: controller.signal,
        headers: { "Cache-Control": "no-cache" },
      });
      clearTimeout(timeoutId);
      if (res.ok) return res;
      const errText = await res.text();
      if (errText.includes("restricted location")) {
        console.warn(`[verify] ${base} geo-blocked, trying next...`);
        continue;
      }
      console.warn(`[verify] ${base}${path} → ${res.status}`);
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      return null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[verify] ${base} failed: ${msg}`);
      continue;
    }
  }
  return null;
}

// Fallback: get current price from CoinGecko
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
// CORE VERIFICATION LOGIC
// ============================================================

interface VerificationResult {
  status: string | null;
  close_reason: string | null;
  tp1_hit_time: string | null;
  tp2_hit_time: string | null;
  tp3_hit_time: string | null;
  loss_hit_time: string | null;
  final_result_candle: Record<string, any> | null;
  current_price: number | null;
  current_price_time: string | null;
  distance_tp1_pct: number | null;
  distance_tp2_pct: number | null;
  distance_tp3_pct: number | null;
  distance_sl_pct: number | null;
  virtual_pnl_pct: number | null;
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
 * Rules:
 * - TP1 only valid if state=ACTIVE and price hasn't hit SL first
 * - After TP1: SL moves to True Breakeven (entry * (1 + 0.001))
 * - TP2 only valid if state=TP1_HIT and price hasn't returned to breakeven
 * - After TP2: SL moves to TP1 price
 * - TP3 only valid if state=TP2_HIT and price hasn't returned to TP1
 * - If price returns to SL (at any phase), operation closes at current phase result
 */
function calcTrueBreakeven(entryPrice: number, isLong: boolean): number {
  // Binance Futures USDT-M fees:
  //   Open (Taker worst-case): 0.05% (0.0005)
  //   Close (STOP_MARKET = Taker): 0.05% (0.0005)
  //   Slippage buffer for STOP_MARKET: 0.02% (0.0002)
  //   TOTAL: 0.12% (0.0012)
  const totalFeeRate = 0.0012;
  return isLong
    ? entryPrice * (1 + totalFeeRate)
    : entryPrice * (1 - totalFeeRate);
}

function verifyKlines(
  klines: (string | number)[][],
  analysis: {
    entry_price: number;
    stop_loss: number;
    take_profit_1: number;
    take_profit_2?: number;
    take_profit_3?: number;
  },
  isLong: boolean,
): VerificationResult {
  const {
    entry_price, stop_loss, take_profit_1, take_profit_2, take_profit_3,
  } = analysis;

  // State machine phases: ACTIVE → TP1_HIT → TP2_HIT → CLOSED
  let tradeState: "ACTIVE" | "TP1_HIT" | "TP2_HIT" | "CLOSED" = "ACTIVE";
  
  // Dynamic SL tracking (trailing stop staircase)
  let currentSL = stop_loss;
  const trueBreakeven = calcTrueBreakeven(entry_price, isLong);

  let tp1HitTime: string | null = null;
  let tp2HitTime: string | null = null;
  let tp3HitTime: string | null = null;
  let finalStatus: string | null = null;
  let lossHitTime: string | null = null;
  let finalCandle: Record<string, any> | null = null;

  // Get current price from last kline
  const lastKline = klines[klines.length - 1];
  const currentPrice = parseFloat(String(lastKline[4]));
  const currentPriceTime = new Date(Number(lastKline[6])).toISOString();

  for (const kline of klines) {
    if (tradeState === "CLOSED") break;

    const openTime = Number(kline[0]);
    const high = parseFloat(String(kline[2]));
    const low = parseFloat(String(kline[3]));
    const close = parseFloat(String(kline[4]));
    const candleTime = new Date(openTime).toISOString();
    const candleData = {
      time: candleTime,
      open: parseFloat(String(kline[1])),
      high, low, close,
      volume: parseFloat(String(kline[5])),
    };

    // For each candle, we must determine order of events.
    // Conservative approach: if BOTH SL and TP could be hit in same candle,
    // check which extreme was hit first using open price direction.

    if (isLong) {
      // ---- LONG LOGIC ----
      
      // Check SL hit (price went below current SL)
      const slHit = low <= currentSL;
      
      // Check TP hit based on current state
      let tpHit = false;
      let tpLevel = 0;
      
      if (tradeState === "ACTIVE" && high >= take_profit_1) {
        tpHit = true;
        tpLevel = 1;
      } else if (tradeState === "TP1_HIT" && take_profit_2 && high >= take_profit_2) {
        tpHit = true;
        tpLevel = 2;
      } else if (tradeState === "TP2_HIT" && take_profit_3 && high >= take_profit_3) {
        tpHit = true;
        tpLevel = 3;
      }

      // If both SL and TP hit in same candle: use open to determine priority
      if (slHit && tpHit) {
        // If open is closer to SL, SL hit first (bearish candle with wick up)
        // If open is closer to TP, TP hit first (bullish candle with wick down)
        const openPrice = parseFloat(String(kline[1]));
        const distToSL = Math.abs(openPrice - currentSL);
        const tpPrice = tpLevel === 1 ? take_profit_1 : tpLevel === 2 ? (take_profit_2 || take_profit_1) : (take_profit_3 || take_profit_1);
        const distToTP = Math.abs(openPrice - tpPrice);
        
        if (distToSL < distToTP) {
          // SL hit first
          tpHit = false;
        } else {
          // TP hit first, then possibly SL
          tpHit = true;
        }
      }

      // Process TP advancement
      if (tpHit && !slHit) {
        if (tpLevel === 1) {
          tp1HitTime = candleTime;
          tradeState = "TP1_HIT";
          currentSL = trueBreakeven; // Move SL to True Breakeven
        } else if (tpLevel === 2) {
          tp2HitTime = candleTime;
          tradeState = "TP2_HIT";
          currentSL = take_profit_1; // Move SL to TP1 (trailing staircase)
        } else if (tpLevel === 3) {
          tp3HitTime = candleTime;
          tradeState = "CLOSED";
          finalStatus = "WIN_TP3";
          finalCandle = candleData;
        }
      }
      // Process SL (also handles post-TP SL hits)
      else if (slHit || (tpHit && slHit)) {
        // If TP was hit first in this candle, advance state then check SL
        if (tpHit) {
          if (tpLevel === 1) {
            tp1HitTime = candleTime;
            tradeState = "TP1_HIT";
          } else if (tpLevel === 2) {
            tp2HitTime = candleTime;
            tradeState = "TP2_HIT";
          }
        }
        
        // Determine final status based on state at SL hit
        if (tradeState === "TP2_HIT") {
          finalStatus = "WIN_TP2";
        } else if (tradeState === "TP1_HIT") {
          finalStatus = "WIN_TP1";
        } else {
          finalStatus = "LOSS";
          lossHitTime = candleTime;
        }
        tradeState = "CLOSED";
        finalCandle = candleData;
      }

    } else {
      // ---- SHORT LOGIC ----
      
      const slHit = high >= currentSL;
      
      let tpHit = false;
      let tpLevel = 0;
      
      if (tradeState === "ACTIVE" && low <= take_profit_1) {
        tpHit = true;
        tpLevel = 1;
      } else if (tradeState === "TP1_HIT" && take_profit_2 && low <= take_profit_2) {
        tpHit = true;
        tpLevel = 2;
      } else if (tradeState === "TP2_HIT" && take_profit_3 && low <= take_profit_3) {
        tpHit = true;
        tpLevel = 3;
      }

      if (slHit && tpHit) {
        const openPrice = parseFloat(String(kline[1]));
        const distToSL = Math.abs(openPrice - currentSL);
        const tpPrice = tpLevel === 1 ? take_profit_1 : tpLevel === 2 ? (take_profit_2 || take_profit_1) : (take_profit_3 || take_profit_1);
        const distToTP = Math.abs(openPrice - tpPrice);
        
        if (distToSL < distToTP) {
          tpHit = false;
        }
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
          if (tpLevel === 1) {
            tp1HitTime = candleTime;
            tradeState = "TP1_HIT";
          } else if (tpLevel === 2) {
            tp2HitTime = candleTime;
            tradeState = "TP2_HIT";
          }
        }
        
        if (tradeState === "TP2_HIT") {
          finalStatus = "WIN_TP2";
        } else if (tradeState === "TP1_HIT") {
          finalStatus = "WIN_TP1";
        } else {
          finalStatus = "LOSS";
          lossHitTime = candleTime;
        }
        tradeState = "CLOSED";
        finalCandle = candleData;
      }
    }
  }

  // Calculate distances from current price
  const distTp1 = take_profit_1 ? calcDistancePct(currentPrice, take_profit_1, isLong) : null;
  const distTp2 = take_profit_2 ? calcDistancePct(currentPrice, take_profit_2, isLong) : null;
  const distTp3 = take_profit_3 ? calcDistancePct(currentPrice, take_profit_3, isLong) : null;
  const distSl = stop_loss ? calcDistancePct(currentPrice, stop_loss, !isLong) : null;
  const virtualPnl = calcVirtualPnl(entry_price, currentPrice, isLong);

  // Derive close_reason from the trade outcome:
  //   WIN_TP1/WIN_TP2 = price returned to breakeven after TP hit → "BREAKEVEN"
  //   WIN_TP3 = full target run → "TP3"
  //   LOSS = stop loss hit before any TP → "SL"
  let closeReason: string | null = null;
  if (finalStatus) {
    if (finalStatus === "WIN_TP3" || finalStatus === "WIN") {
      closeReason = "TP3";
    } else if (finalStatus === "WIN_TP1" || finalStatus === "WIN_TP2") {
      closeReason = "BREAKEVEN";
    } else if (finalStatus === "LOSS") {
      closeReason = "SL";
    }
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

    // Fetch all PENDING analyses (including partial wins still open), excluding soft-deleted
    const { data: pendingAnalyses, error: fetchErr } = await supabase
      .from("auto_analysis_history")
      .select("*")
      .in("status", ["PENDING", "WIN_TP1", "WIN_TP2"])
      .is("deleted_at", null);

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

    let verified = 0;
    const now = new Date().toISOString();

    for (const analysis of pendingAnalyses) {
      try {
        const { id, asset, timeframe, signal, entry_price, stop_loss, take_profit_1, created_at } = analysis;

        if (!entry_price || !stop_loss || !take_profit_1) {
          console.log(`[verify] Skipping ${id} — missing price levels`);
          continue;
        }

        const normalizedSignal = normalizeSignal(signal);

        // Hard guard: neutral signals can never keep TP/LOSS outcomes
        if (isNeutralSignal(normalizedSignal)) {
          const { error: neutralizeErr } = await supabase
            .from("auto_analysis_history")
            .update({
              status: "NEUTRAL",
              entry_price: null,
              stop_loss: null,
              take_profit_1: null,
              take_profit_2: null,
              take_profit_3: null,
              tp1_hit_time: null,
              tp2_hit_time: null,
              tp3_hit_time: null,
              loss_hit_time: null,
              final_result_candle: null,
              current_price: null,
              current_price_time: null,
              distance_tp1_pct: null,
              distance_tp2_pct: null,
              distance_tp3_pct: null,
              distance_sl_pct: null,
              virtual_pnl_pct: null,
              last_verified_at: now,
            })
            .eq("id", id);

          if (neutralizeErr) {
            console.error(`[verify] Failed to neutralize inconsistent analysis ${id}:`, neutralizeErr.message);
          } else {
            console.log(`[verify] 🔧 ${id} normalized to NEUTRAL (signal=${normalizedSignal})`);
            verified++;
          }
          continue;
        }

        // Determine direction
        let isLong = normalizedSignal === "COMPRA" || normalizedSignal === "BUY" || normalizedSignal === "LONG";
        let isShort = normalizedSignal === "VENDA" || normalizedSignal === "SELL" || normalizedSignal === "SHORT";

        if (!isLong && !isShort) {
          if (take_profit_1 > entry_price) {
            isLong = true;
          } else if (take_profit_1 < entry_price) {
            isShort = true;
          } else {
            console.log(`[verify] Skipping ${id} — cannot infer direction`);
            continue;
          }
        }

        const symbol = toBinanceSymbol(asset);
        const interval = toBinanceInterval(timeframe);
        const startTime = new Date(created_at).getTime();
        const endTime = Date.now();

        // Fetch klines with multi-endpoint fallback
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
          console.warn(`[verify] All Binance endpoints failed for ${symbol}, trying CoinGecko...`);
          currentPrice = await fetchCoinGeckoPrice(symbol);
        }

        // If we have klines, run full verification
        if (klines.length > 0) {
          const result = verifyKlines(klines, analysis, isLong);

          const updatePayload: Record<string, any> = {
            current_price: result.current_price,
            current_price_time: result.current_price_time,
            distance_tp1_pct: result.distance_tp1_pct,
            distance_tp2_pct: result.distance_tp2_pct,
            distance_tp3_pct: result.distance_tp3_pct,
            distance_sl_pct: result.distance_sl_pct,
            virtual_pnl_pct: result.virtual_pnl_pct,
            last_verified_at: now,
          };

          // State machine results: sequential validation already done
          updatePayload.tp1_hit_time = result.tp1_hit_time;
          updatePayload.tp2_hit_time = result.tp2_hit_time;
          updatePayload.tp3_hit_time = result.tp3_hit_time;

          if (result.status) {
            updatePayload.status = result.status;
            if (result.loss_hit_time) updatePayload.loss_hit_time = result.loss_hit_time;
            if (result.final_result_candle) updatePayload.final_result_candle = result.final_result_candle;
          } else if (result.tp2_hit_time) {
            updatePayload.status = "WIN_TP2";
          } else if (result.tp1_hit_time) {
            updatePayload.status = "WIN_TP1";
          }

          const { error: updateErr } = await supabase
            .from("auto_analysis_history")
            .update(updatePayload)
            .eq("id", id);

          if (updateErr) {
            console.error(`[verify] Update failed ${id}:`, updateErr.message);
          } else {
            const label = updatePayload.status || analysis.status;
            console.log(`[verify] ✅ ${symbol} ${id} → ${label} | Price: ${result.current_price} | PnL: ${result.virtual_pnl_pct}% | TP1: ${result.distance_tp1_pct}% | SL: ${result.distance_sl_pct}%`);
            verified++;
          }
        } else if (currentPrice !== null) {
          // CoinGecko fallback: update only price tracking (no kline verification)
          const virtualPnl = calcVirtualPnl(entry_price, currentPrice, isLong);
          const distTp1 = take_profit_1 ? calcDistancePct(currentPrice, take_profit_1, isLong) : null;
          const distSl = stop_loss ? calcDistancePct(currentPrice, stop_loss, !isLong) : null;

          const { error: updateErr } = await supabase
            .from("auto_analysis_history")
            .update({
              current_price: currentPrice,
              current_price_time: now,
              distance_tp1_pct: distTp1 !== null ? parseFloat(distTp1.toFixed(4)) : null,
              distance_sl_pct: distSl !== null ? parseFloat(distSl.toFixed(4)) : null,
              virtual_pnl_pct: parseFloat(virtualPnl.toFixed(4)),
              last_verified_at: now,
            })
            .eq("id", id);

          if (!updateErr) {
            console.log(`[verify] 📊 ${symbol} ${id} — CoinGecko price: $${currentPrice} | PnL: ${virtualPnl.toFixed(2)}%`);
            verified++;
          }
        } else {
          console.error(`[verify] ❌ ${symbol} — No data source available`);
        }

        // Rate limiting between requests
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`[verify] Error ${analysis.id}:`, err);
      }
    }

    console.log(`[verify] Done. Verified ${verified}/${pendingAnalyses.length} analyses.`);

    // ========== AUTO-TRIGGER: auto-refine after finalizations ==========
    // Count how many analyses were finalized (transitioned to WIN/LOSS) in this run
    let finalizedCount = 0;
    for (const analysis of pendingAnalyses) {
      const wasOpen = ["PENDING", "WIN_TP1", "WIN_TP2"].includes(analysis.status);
      if (!wasOpen) continue;
      // Check if this analysis was updated to a final status
      const { data: updated } = await supabase
        .from("auto_analysis_history")
        .select("status")
        .eq("id", analysis.id)
        .single();
      if (updated && ["WIN_TP1", "WIN_TP2", "WIN_TP3", "WIN", "LOSS"].includes(updated.status) && updated.status !== analysis.status) {
        finalizedCount++;
      }
    }

    if (finalizedCount > 0) {
      console.log(`[verify] 🔄 ${finalizedCount} analyses finalized — triggering auto-refine...`);
      try {
        const refineUrl = `${supabaseUrl}/functions/v1/auto-refine`;
        const refineRes = await fetch(refineUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ mode: "full" }),
        });
        console.log(`[verify] auto-refine response: ${refineRes.status}`);
      } catch (refineErr) {
        console.error(`[verify] auto-refine trigger failed:`, refineErr);
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
