import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================
// REGRA PÉTREA UL-MAXIMIZER
// ============================================================
// Função Objetivo: Maximizar UL (Utility/Lucro)
//   UL = Σ(Reward Wins capturados) - Σ(Penalty Losses) - Σ(Custo Oportunidade Wins perdidos)
//
// Hierarquia:
//   1. Evitar LOSS (custo -3.0, mais caro que qualquer win exceto TP3)
//   2. Capturar WIN_TP2/TP3 (+2.0/+3.0, compensa losses)
//   3. Preferir NEUTRO ao risco (NEUTRO que evita loss = +1.5)
//   4. Não perder oportunidades (WIN_TP3 perdido custa -1.0)
// ============================================================

// UL reward/penalty table by status
const UL_VALUES: Record<string, number> = {
  WIN_TP3: 3.0,
  WIN_TP2: 2.0,
  WIN_TP1: 1.0,
  WIN: 1.0,        // generic win = TP1
  LOSS: -3.0,
};

// Cost of missing a win (opportunity cost when we go NEUTRAL on a winning trade)
const UL_MISSED_COST: Record<string, number> = {
  WIN_TP3: -1.0,
  WIN_TP2: -0.6,
  WIN_TP1: -0.3,
  WIN: -0.3,
};

// Reward for avoiding a loss (correctly going NEUTRAL on a losing trade)
const UL_LOSS_AVOIDED = 1.5;

// Reward for correct neutral (signal was neutral, stayed neutral)
const UL_NEUTRAL_CORRECT = 0.2;

// All known indicator names from the confluence engine
const ALL_INDICATORS = [
  "ICHIMOKU", "EMA200", "BOS", "EMA_ALIGNMENT", "EMA_CROSSOVER",
  "MACD_HIST", "MACD_LINE", "MACD_SLOPE", "MACD_ACCEL", "ADX_DIR", "RSI_SLOPE",
  "SMA10", "SMA20", "SMA50", "SMA100", "SMA200",
  "EMA10", "EMA20", "EMA50", "EMA100",
  "VWAP", "OBV_SLOPE", "MFI", "VOL_DELTA", "TAKER_BUY",
  "RSI", "STOCH", "BOLL", "CCI", "WILLIAMS_R", "AO", "MOMENTUM", "STOCH_RSI", "BULL_BEAR", "ULT_OSC",
  "OPEN_INTEREST", "FEAR_GREED", "FUNDING_RATE", "MC_REGIME",
  "FIB_PROXIMITY", "DIV_RSI", "DIV_MACD",
  "DOJI", "HAMMER", "SHOOTING_STAR", "BULLISH_ENGULFING", "BEARISH_ENGULFING", "MORNING_STAR", "EVENING_STAR",
];

// Default weights from the confluence engine
const DEFAULT_WEIGHTS: Record<string, number> = {
  ICHIMOKU: 2.0, EMA200: 1.5, BOS: 2.0, EMA_ALIGNMENT: 1.5, EMA_CROSSOVER: 2.5,
  MACD_HIST: 2.0, MACD_LINE: 2.0, MACD_SLOPE: 1.5, MACD_ACCEL: 1.0, ADX_DIR: 2.0, RSI_SLOPE: 1.5,
  SMA10: 1.0, SMA20: 1.0, SMA50: 1.0, SMA100: 1.0, SMA200: 1.0,
  EMA10: 1.0, EMA20: 1.0, EMA50: 1.0, EMA100: 1.0,
  VWAP: 2.0, OBV_SLOPE: 2.0, MFI: 1.0, VOL_DELTA: 1.5, TAKER_BUY: 2.0,
  RSI: 1.5, STOCH: 1.0, BOLL: 1.0, CCI: 1.0, WILLIAMS_R: 1.0, AO: 1.0, MOMENTUM: 1.0, STOCH_RSI: 1.0, BULL_BEAR: 1.0, ULT_OSC: 1.0,
  OPEN_INTEREST: 1.5, FEAR_GREED: 1.5, FUNDING_RATE: 1.0, MC_REGIME: 1.5,
  FIB_PROXIMITY: 1.5, DIV_RSI: 2.5, DIV_MACD: 2.5,
  DOJI: 1.0, HAMMER: 1.0, SHOOTING_STAR: 1.0, BULLISH_ENGULFING: 2.0, BEARISH_ENGULFING: 2.0, MORNING_STAR: 2.0, EVENING_STAR: 2.0,
};

interface IndicatorDirection {
  name: string;
  direction: string;
}

interface AnalysisFullResult {
  technical_indicators?: Record<string, any>;
  risk_management?: { entry_price?: number };
  header?: { signal?: string };
  _obv_slope?: { obvTrend?: string };
  _volume_delta?: { pressure?: string };
  _taker_data?: { pressure?: string };
  _fear_greed?: { value?: number };
  _funding_rate?: number | null;
  _rsi_momentum?: { direction?: string };
  _ema_crossover?: { crossed?: boolean; type?: string };
}

// ============================================================
// TEMPORAL DECAY: Recent data matters more
// ============================================================
function getTemporalWeight(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 7) return 1.0;
  if (ageDays <= 30) return 0.7;
  if (ageDays <= 90) return 0.4;
  return 0.2;
}

// ============================================================
// INDICATOR DIRECTION EXTRACTION (shared logic)
// ============================================================
function extractIndicatorDirections(fr: AnalysisFullResult): IndicatorDirection[] {
  const results: Array<{ name: string; direction: string }> = [];
  const ti = fr.technical_indicators || {};
  const entryP = fr.risk_management?.entry_price || 0;

  if (ti.rsi) {
    const dir = ti.rsi.value > 70 ? "SELL" : ti.rsi.value < 30 ? "BUY" : "NEUTRAL";
    results.push({ name: "RSI", direction: dir });
  }
  if (ti.macd) {
    results.push({ name: "MACD_HIST", direction: ti.macd.histogram > 0 ? "BUY" : ti.macd.histogram < 0 ? "SELL" : "NEUTRAL" });
    results.push({ name: "MACD_LINE", direction: ti.macd.value > ti.macd.signal_line ? "BUY" : "SELL" });
  }
  if (ti.adx && ti.adx.value > 20) {
    const signal = fr.header?.signal || "NEUTRO";
    const isBuy = signal === "COMPRA" || signal === "BUY";
    const isSell = signal === "VENDA" || signal === "SELL";
    results.push({ name: "ADX_DIR", direction: isBuy ? "BUY" : isSell ? "SELL" : "NEUTRAL" });
  }
  if (ti.stochastic) {
    results.push({ name: "STOCH", direction: ti.stochastic.k < 30 ? "BUY" : ti.stochastic.k > 70 ? "SELL" : "NEUTRAL" });
  }
  if (ti.bollinger && entryP) {
    results.push({ name: "BOLL", direction: entryP < ti.bollinger.lower ? "BUY" : entryP > ti.bollinger.upper ? "SELL" : "NEUTRAL" });
  }
  if (ti.cci !== undefined) {
    results.push({ name: "CCI", direction: ti.cci < -100 ? "BUY" : ti.cci > 100 ? "SELL" : "NEUTRAL" });
  }
  if (ti.mfi !== undefined) {
    results.push({ name: "MFI", direction: ti.mfi < 20 ? "BUY" : ti.mfi > 80 ? "SELL" : "NEUTRAL" });
  }
  if (ti.ichimoku) {
    results.push({ name: "ICHIMOKU", direction: ti.ichimoku.signal === "BULLISH" ? "BUY" : ti.ichimoku.signal === "BEARISH" ? "SELL" : "NEUTRAL" });
  }
  if (ti.vwap && entryP) {
    results.push({ name: "VWAP", direction: entryP > ti.vwap * 1.001 ? "BUY" : entryP < ti.vwap * 0.999 ? "SELL" : "NEUTRAL" });
  }
  if (ti.ema_20 && ti.ema_50 && ti.ema_200) {
    if (ti.ema_20 > ti.ema_50 && ti.ema_50 > ti.ema_200) results.push({ name: "EMA_ALIGNMENT", direction: "BUY" });
    else if (ti.ema_20 < ti.ema_50 && ti.ema_50 < ti.ema_200) results.push({ name: "EMA_ALIGNMENT", direction: "SELL" });
    else results.push({ name: "EMA_ALIGNMENT", direction: "NEUTRAL" });
    results.push({ name: "EMA20", direction: entryP > ti.ema_20 ? "BUY" : "SELL" });
    results.push({ name: "EMA50", direction: entryP > ti.ema_50 ? "BUY" : "SELL" });
    results.push({ name: "EMA200", direction: entryP > ti.ema_200 ? "BUY" : "SELL" });
  }
  if (fr._obv_slope) {
    results.push({ name: "OBV_SLOPE", direction: fr._obv_slope.obvTrend === "ACCUMULATION" ? "BUY" : fr._obv_slope.obvTrend === "DISTRIBUTION" ? "SELL" : "NEUTRAL" });
  }
  if (fr._volume_delta) {
    results.push({ name: "VOL_DELTA", direction: fr._volume_delta.pressure === "COMPRADORES" ? "BUY" : fr._volume_delta.pressure === "VENDEDORES" ? "SELL" : "NEUTRAL" });
  }
  if (fr._taker_data) {
    results.push({ name: "TAKER_BUY", direction: fr._taker_data.pressure === "COMPRADORES_AGRESSIVOS" ? "BUY" : fr._taker_data.pressure === "VENDEDORES_AGRESSIVOS" ? "SELL" : "NEUTRAL" });
  }
  if (fr._fear_greed && fr._fear_greed.value !== undefined) {
    results.push({ name: "FEAR_GREED", direction: fr._fear_greed.value < 25 ? "BUY" : fr._fear_greed.value > 75 ? "SELL" : "NEUTRAL" });
  }
  if (fr._funding_rate !== null && fr._funding_rate !== undefined) {
    results.push({ name: "FUNDING_RATE", direction: fr._funding_rate > 0.0005 ? "SELL" : fr._funding_rate < -0.0005 ? "BUY" : "NEUTRAL" });
  }
  if (ti.divergences) {
    ti.divergences.forEach((d: { indicator: string; type: string }) => {
      results.push({ name: `DIV_${d.indicator}`, direction: d.type === "BULLISH" ? "BUY" : "SELL" });
    });
  }
  if (ti.candle_patterns) {
    ti.candle_patterns.forEach((p: { name: string; type: string }) => {
      results.push({ name: p.name, direction: p.type === "BULLISH" ? "BUY" : "SELL" });
    });
  }
  if (fr._rsi_momentum) {
    results.push({ name: "RSI_SLOPE", direction: fr._rsi_momentum.direction === "ACCELERATING" ? "BUY" : fr._rsi_momentum.direction === "DECELERATING" ? "SELL" : "NEUTRAL" });
  }
  if (fr._ema_crossover?.crossed) {
    results.push({ name: "EMA_CROSSOVER", direction: fr._ema_crossover.type === "GOLDEN_CROSS" ? "BUY" : "SELL" });
  }

  return results;
}

// ============================================================
// UL-AWARE ASYMMETRIC SCORING (v2)
// Score each indicator's contribution using UL values
// ============================================================
function calcULScore(
  direction: string,
  analysisSignal: string,
  status: string,
): { wasCorrect: boolean; ulScore: number } {
  const isBuy = analysisSignal === "COMPRA" || analysisSignal === "BUY";
  const isSell = analysisSignal === "VENDA" || analysisSignal === "SELL";
  const isNeutralSignal = !isBuy && !isSell;
  const isWin = status.startsWith("WIN");
  const isLoss = status === "LOSS";

  if (direction === "NEUTRAL") {
    if (isNeutralSignal) {
      return { wasCorrect: true, ulScore: UL_NEUTRAL_CORRECT };
    }
    if (isLoss) {
      // Neutral indicator warned against a LOSS → excellent
      return { wasCorrect: true, ulScore: UL_LOSS_AVOIDED };
    }
    // Neutral indicator but signal was WIN → missed opportunity (graduated by TP level)
    const missedCost = UL_MISSED_COST[status] || -0.3;
    return { wasCorrect: false, ulScore: missedCost };
  }

  // Directional indicator
  const alignedWithSignal = (direction === "BUY" && isBuy) || (direction === "SELL" && isSell);
  const opposedToSignal = (direction === "BUY" && isSell) || (direction === "SELL" && isBuy);

  if (alignedWithSignal) {
    if (isWin) {
      // Aligned + WIN → graduated reward by TP level
      const reward = UL_VALUES[status] || 1.0;
      return { wasCorrect: true, ulScore: reward };
    }
    // Aligned + LOSS → SEVERE penalty (led to a loss)
    return { wasCorrect: false, ulScore: -3.5 };
  }

  if (opposedToSignal) {
    if (isLoss) {
      // Opposed + LOSS → correctly warned against
      return { wasCorrect: true, ulScore: 2.0 };
    }
    // Opposed + WIN → disagreed but trade worked
    const oppCost = -(UL_VALUES[status] || 1.0) * 0.4;
    return { wasCorrect: false, ulScore: oppCost };
  }

  // Neutral signal context with directional indicator
  if (isNeutralSignal) {
    return { wasCorrect: false, ulScore: 0.0 };
  }

  return { wasCorrect: false, ulScore: 0.0 };
}

// ============================================================
// BACKTEST ENGINE: Sweep thresholds to maximize UL
// ============================================================
interface FinalizedAnalysis {
  id: string;
  asset: string;
  timeframe: string;
  signal: string | null;
  status: string;
  full_result: AnalysisFullResult;
  created_at: string;
}

interface BacktestDetail {
  id: string;
  original_signal: string;
  recalc_signal: string;
  actual_result: string;
  buy_pct: number;
  sell_pct: number;
  ul_contribution: number;
  loss_avoided: boolean;
  missed_opportunity: boolean;
}

interface BacktestResult {
  threshold: number;
  ulTotal: number;
  correct: number;
  total: number;
  changes: number;
  lossesAvoided: number;
  totalLosses: number;
  missedOpps: number;
  totalWins: number;
  lossAvoidanceRate: number;
  missedOpportunityRate: number;
  details: BacktestDetail[];
}

function runBacktest(
  allFinalized: FinalizedAnalysis[],
  weightMap: Map<string, number>,
  threshold: number,
): BacktestResult {
  let ulTotal = 0;
  let correct = 0, total = 0, changes = 0;
  let lossesAvoided = 0, totalLosses = 0;
  let missedOpps = 0, totalWins = 0;
  const details: BacktestDetail[] = [];

  for (const hist of allFinalized) {
    const fr = hist.full_result;
    if (!fr) continue;

    const isWin = hist.status?.startsWith("WIN");
    const isLoss = hist.status === "LOSS";
    const originalSignal = hist.signal || fr?.header?.signal || "NEUTRO";
    const originalNormalized = originalSignal === "COMPRA" || originalSignal === "BUY" ? "COMPRA" :
      originalSignal === "VENDA" || originalSignal === "SELL" ? "VENDA" : "NEUTRO";

    if (isLoss) totalLosses++;
    if (isWin && originalNormalized !== "NEUTRO") totalWins++;

    const indicators = extractIndicatorDirections(fr);
    let buyScore = 0, sellScore = 0, totalWeight = 0;

    for (const ind of indicators) {
      const w = weightMap.get(ind.name) ?? DEFAULT_WEIGHTS[ind.name] ?? 1.0;
      totalWeight += w;
      if (ind.direction === "BUY") buyScore += w;
      else if (ind.direction === "SELL") sellScore += w;
    }

    const buyPct = totalWeight > 0 ? (buyScore / totalWeight) * 100 : 50;
    const sellPct = totalWeight > 0 ? (sellScore / totalWeight) * 100 : 50;

    let recalcSignal = "NEUTRO";
    if (buyPct > threshold) recalcSignal = "COMPRA";
    else if (sellPct > threshold) recalcSignal = "VENDA";

    // Calculate UL contribution for this analysis
    let analysisUL = 0;
    const lossAvoided = isLoss && recalcSignal === "NEUTRO" && originalNormalized !== "NEUTRO";
    const missedOpp = isWin && recalcSignal === "NEUTRO" && originalNormalized !== "NEUTRO";

    if (recalcSignal === "NEUTRO") {
      if (isLoss && originalNormalized !== "NEUTRO") {
        // Loss avoided → positive UL
        analysisUL = UL_LOSS_AVOIDED;
        lossesAvoided++;
      } else if (isWin && originalNormalized !== "NEUTRO") {
        // Missed opportunity → negative UL (graduated)
        analysisUL = UL_MISSED_COST[hist.status] || -0.3;
        missedOpps++;
      } else {
        analysisUL = UL_NEUTRAL_CORRECT;
      }
    } else {
      // Actionable signal
      const recalcAligned = (recalcSignal === "COMPRA" && originalNormalized === "COMPRA") ||
                            (recalcSignal === "VENDA" && originalNormalized === "VENDA");
      if (recalcAligned && isWin) {
        analysisUL = UL_VALUES[hist.status] || 1.0;
      } else if (recalcAligned && isLoss) {
        analysisUL = UL_VALUES.LOSS; // -3.0
      } else if (!recalcAligned && isWin) {
        // Recalc flipped direction on a win → bad
        analysisUL = -(UL_VALUES[hist.status] || 1.0) * 0.5;
      } else if (!recalcAligned && isLoss) {
        // Recalc flipped direction on a loss → might have saved it
        analysisUL = UL_LOSS_AVOIDED * 0.5;
      } else {
        analysisUL = 0;
      }
    }

    ulTotal += analysisUL;
    total++;

    // "Correct" = positive UL contribution
    if (analysisUL > 0) correct++;
    if (recalcSignal !== originalNormalized) changes++;

    details.push({
      id: hist.id,
      original_signal: originalNormalized,
      recalc_signal: recalcSignal,
      actual_result: hist.status,
      buy_pct: parseFloat(buyPct.toFixed(1)),
      sell_pct: parseFloat(sellPct.toFixed(1)),
      ul_contribution: parseFloat(analysisUL.toFixed(2)),
      loss_avoided: lossAvoided,
      missed_opportunity: missedOpp,
    });
  }

  const lossAvoidanceRate = totalLosses > 0 ? (lossesAvoided / totalLosses) * 100 : 0;
  const missedOpportunityRate = totalWins > 0 ? (missedOpps / totalWins) * 100 : 0;

  return {
    threshold, ulTotal: parseFloat(ulTotal.toFixed(2)),
    correct, total, changes,
    lossesAvoided, totalLosses,
    missedOpps, totalWins,
    lossAvoidanceRate, missedOpportunityRate,
    details,
  };
}

// ============================================================
// THRESHOLD SWEEP OPTIMIZER
// Finds the threshold that maximizes UL with safety constraints
// ============================================================
function findOptimalThreshold(
  allFinalized: FinalizedAnalysis[],
  weightMap: Map<string, number>,
): { best: BacktestResult; sweep: Array<{ threshold: number; ul: number; lossAvoid: number; missedOpp: number }> } {
  const MIN_THRESHOLD = 42;
  const MAX_THRESHOLD = 72;
  const STEP = 1;
  const MIN_LOSS_AVOIDANCE = 50; // Safety: must avoid at least 50% of losses

  let bestResult: BacktestResult | null = null;
  let bestUL = -Infinity;
  const sweep: Array<{ threshold: number; ul: number; lossAvoid: number; missedOpp: number }> = [];

  for (let t = MIN_THRESHOLD; t <= MAX_THRESHOLD; t += STEP) {
    const result = runBacktest(allFinalized, weightMap, t);
    sweep.push({
      threshold: t,
      ul: result.ulTotal,
      lossAvoid: parseFloat(result.lossAvoidanceRate.toFixed(1)),
      missedOpp: parseFloat(result.missedOpportunityRate.toFixed(1)),
    });

    // Safety constraint: lossAvoidanceRate must be >= 50%
    // (unless there are very few losses where any threshold would fail)
    const passesConstraint = result.totalLosses < 3 || result.lossAvoidanceRate >= MIN_LOSS_AVOIDANCE;

    if (passesConstraint && result.ulTotal > bestUL) {
      bestUL = result.ulTotal;
      bestResult = result;
    }
  }

  // Fallback: if no threshold passes constraint, use the one with highest UL anyway
  if (!bestResult) {
    for (let t = MIN_THRESHOLD; t <= MAX_THRESHOLD; t += STEP) {
      const result = runBacktest(allFinalized, weightMap, t);
      if (result.ulTotal > bestUL) {
        bestUL = result.ulTotal;
        bestResult = result;
      }
    }
  }

  // Anti-stagnation guard
  if (bestResult) {
    if (bestResult.missedOpportunityRate > 60 && bestResult.threshold > MIN_THRESHOLD + 3) {
      // Too conservative: force threshold down
      const adjusted = runBacktest(allFinalized, weightMap, bestResult.threshold - 3);
      console.log(`[AUTO-REFINE] Anti-stagnation: missedOpp ${bestResult.missedOpportunityRate.toFixed(1)}% > 60%, lowering threshold ${bestResult.threshold} → ${adjusted.threshold}`);
      bestResult = adjusted;
    }
    if (bestResult.lossAvoidanceRate < 30 && bestResult.threshold < MAX_THRESHOLD - 3) {
      // Too aggressive: force threshold up
      const adjusted = runBacktest(allFinalized, weightMap, bestResult.threshold + 3);
      console.log(`[AUTO-REFINE] Anti-stagnation: lossAvoid ${bestResult.lossAvoidanceRate.toFixed(1)}% < 30%, raising threshold ${bestResult.threshold} → ${adjusted.threshold}`);
      bestResult = adjusted;
    }
  }

  return { best: bestResult!, sweep };
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

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "full"; // "extract" | "calibrate" | "full" | "reset"

    console.log(`[AUTO-REFINE] Starting mode: ${mode} | UL-Maximizer v2 | Regra Pétrea: Max UL (evitar LOSS > capturar WIN)`);

    const results: any = { extracted: 0, calibrated: 0, logs: [] };

    // ========== STEP 1: EXTRACT INDICATOR PERFORMANCE ==========
    if (mode === "extract" || mode === "full") {
      const { data: finalizedAnalyses, error: fetchErr } = await supabase
        .from("auto_management_history")
        .select("id, asset, timeframe, signal, status, full_result, created_at")
        .in("status", ["WIN_TP1", "WIN_TP2", "WIN_TP3", "WIN", "LOSS"])
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);

      if (fetchErr) throw new Error(`Fetch error: ${fetchErr.message}`);

      const analysisIds = (finalizedAnalyses || []).map((a: any) => a.id);
      const { data: existingPerf } = await supabase
        .from("management_indicator_performance")
        .select("analysis_id")
        .in("analysis_id", analysisIds.length > 0 ? analysisIds : ["__none__"]);

      const existingSet = new Set((existingPerf || []).map((p: any) => p.analysis_id));
      const newAnalyses = (finalizedAnalyses || []).filter((a: any) => !existingSet.has(a.id));

      console.log(`[AUTO-REFINE] Found ${finalizedAnalyses?.length || 0} finalized, ${newAnalyses.length} new to extract`);

      for (const analysis of newAnalyses) {
        const fullResult = analysis.full_result;
        if (!fullResult) continue;

        const analysisSignal = analysis.signal || fullResult?.header?.signal || "NEUTRO";
        const indicators = extractIndicatorDirections(fullResult);
        const indicatorRecords: any[] = [];

        for (const ind of indicators) {
          const { wasCorrect } = calcULScore(ind.direction, analysisSignal, analysis.status);

          indicatorRecords.push({
            analysis_id: analysis.id,
            asset: analysis.asset,
            timeframe: analysis.timeframe,
            indicator_name: ind.name,
            direction_suggested: ind.direction,
            weight_used: DEFAULT_WEIGHTS[ind.name] || 1.0,
            actual_result: analysis.status.startsWith("WIN") ? "WIN" : "LOSS",
            was_correct: wasCorrect,
          });
        }

        if (indicatorRecords.length > 0) {
          const { error: insertErr } = await supabase
            .from("management_indicator_performance")
            .insert(indicatorRecords);
          if (insertErr) {
            console.error(`[AUTO-REFINE] Insert error for ${analysis.id}:`, insertErr.message);
          } else {
            results.extracted += indicatorRecords.length;
          }
        }
      }

      console.log(`[AUTO-REFINE] Extracted ${results.extracted} indicator records from ${newAnalyses.length} analyses`);
    }

    // ========== STEP 2: UL-GRADIENT CALIBRATION ==========
    if (mode === "calibrate" || mode === "full") {
      const { data: combos } = await supabase
        .from("management_indicator_performance")
        .select("asset, timeframe")
        .limit(1000);

      const uniqueCombos = new Map<string, { asset: string; timeframe: string }>();
      (combos || []).forEach((c: any) => {
        const key = `${c.asset}_${c.timeframe}`;
        if (!uniqueCombos.has(key)) uniqueCombos.set(key, { asset: c.asset, timeframe: c.timeframe });
      });

      for (const [_, combo] of uniqueCombos) {
        const { asset, timeframe } = combo;

        // Get all finalized analyses for backtest
        const { data: allFinalized } = await supabase
          .from("auto_management_history")
          .select("id, asset, timeframe, signal, status, full_result, created_at")
          .eq("asset", asset)
          .eq("timeframe", timeframe)
          .in("status", ["WIN_TP1", "WIN_TP2", "WIN_TP3", "WIN", "LOSS"])
          .is("deleted_at", null)
          .limit(500);

        // Get indicator performance with analysis status for UL scoring
        const { data: perfData } = await supabase
          .from("management_indicator_performance")
          .select("indicator_name, was_correct, weight_used, actual_result, direction_suggested, created_at, analysis_id")
          .eq("asset", asset)
          .eq("timeframe", timeframe);

        if (!perfData || perfData.length < 5) {
          console.log(`[AUTO-REFINE] Skipping ${asset}/${timeframe}: only ${perfData?.length || 0} records (need 5+)`);
          continue;
        }

        // Build analysis status lookup for UL scoring
        const analysisStatusMap = new Map<string, string>();
        (allFinalized || []).forEach((a: any) => analysisStatusMap.set(a.id, a.status));

        // Build analysis signal lookup
        const analysisSignalMap = new Map<string, string>();
        (allFinalized || []).forEach((a: any) => {
          const sig = a.signal || a.full_result?.header?.signal || "NEUTRO";
          analysisSignalMap.set(a.id, sig);
        });

        // ============================================================
        // UL-GRADIENT CALIBRATION per indicator
        // ============================================================
        const indicatorStats = new Map<string, {
          ulContribTotal: number;
          weightedTotal: number;
          rawCorrect: number;
          rawTotal: number;
          losses: number;
          wins: number;
          originalWeight: number;
        }>();

        perfData.forEach((p: any) => {
          const tempWeight = getTemporalWeight(p.created_at);
          const status = analysisStatusMap.get(p.analysis_id) || (p.actual_result === "WIN" ? "WIN_TP1" : "LOSS");
          const signal = analysisSignalMap.get(p.analysis_id) || "NEUTRO";

          const { wasCorrect, ulScore } = calcULScore(p.direction_suggested, signal, status);

          const existing = indicatorStats.get(p.indicator_name) || {
            ulContribTotal: 0, weightedTotal: 0,
            rawCorrect: 0, rawTotal: 0,
            losses: 0, wins: 0,
            originalWeight: p.weight_used || 1,
          };

          existing.ulContribTotal += ulScore * tempWeight;
          existing.weightedTotal += tempWeight;
          existing.rawTotal++;
          if (wasCorrect) existing.rawCorrect++;
          if (p.actual_result === "LOSS") existing.losses++;
          if (p.actual_result === "WIN") existing.wins++;

          indicatorStats.set(p.indicator_name, existing);
        });

        // Overall WR before
        const totalCorrect = perfData.filter((p: any) => p.was_correct).length;
        const overallWRBefore = (totalCorrect / perfData.length) * 100;

        interface CalibratedAdjustment {
          indicator: string;
          action: string;
          wr: string;
          ul_contrib: string;
          from: number;
          to: number;
          samples: number;
          losses?: number;
        }
        interface UpsertRow {
          asset: string;
          timeframe: string;
          indicator_name: string;
          original_weight: number;
          calibrated_weight: number;
          win_rate: number;
          sample_count: number;
          trend: string;
          last_calibrated_at: string;
        }

        const adjustments: CalibratedAdjustment[] = [];
        const upsertRows: UpsertRow[] = [];

        for (const [indicatorName, stats] of indicatorStats) {
          const rawWr = stats.rawTotal > 0 ? (stats.rawCorrect / stats.rawTotal) * 100 : 50;
          const originalWeight = DEFAULT_WEIGHTS[indicatorName] || stats.originalWeight || 1.0;

          // UL Contribution per participation (normalized)
          const ulContrib = stats.weightedTotal > 0 ? stats.ulContribTotal / stats.weightedTotal : 0;

          let calibratedWeight = originalWeight;
          let trend = "STABLE";

          // Minimum 5 samples to calibrate
          if (stats.rawTotal >= 5) {
            // KILL SWITCH: if UL_contrib < -2.0 with 5+ loss participations → silence
            if (ulContrib < -2.0 && stats.losses >= 5) {
              calibratedWeight = 0.05;
              trend = "KILLED";
              adjustments.push({
                indicator: indicatorName, action: "KILL",
                wr: rawWr.toFixed(1), ul_contrib: ulContrib.toFixed(3),
                losses: stats.losses,
                from: originalWeight, to: 0.05,
                samples: stats.rawTotal,
              });
            } else if (ulContrib > 0.5) {
              // Strong positive UL → boost (up to 1.4x original, cap at 4.0)
              const boostFactor = 1.0 + Math.min(0.4, (ulContrib - 0.5) * 0.3);
              calibratedWeight = Math.min(originalWeight * boostFactor, Math.min(originalWeight * 2.0, 4.0));
              trend = "IMPROVING";
              adjustments.push({
                indicator: indicatorName, action: "BOOST",
                wr: rawWr.toFixed(1), ul_contrib: ulContrib.toFixed(3),
                from: originalWeight, to: parseFloat(calibratedWeight.toFixed(2)),
                samples: stats.rawTotal,
              });
            } else if (ulContrib < -0.3) {
              // Negative UL → reduce proportionally (floor at 0.1)
              const reduceFactor = Math.max(0.15, 1.0 + (ulContrib * 0.5));
              calibratedWeight = Math.max(originalWeight * reduceFactor, 0.1);
              trend = "DEGRADING";
              adjustments.push({
                indicator: indicatorName, action: "REDUCE",
                wr: rawWr.toFixed(1), ul_contrib: ulContrib.toFixed(3),
                from: originalWeight, to: parseFloat(calibratedWeight.toFixed(2)),
                samples: stats.rawTotal,
              });
            }
            // Between -0.3 and 0.5: stable
          }

          upsertRows.push({
            asset,
            timeframe,
            indicator_name: indicatorName,
            original_weight: originalWeight,
            calibrated_weight: parseFloat(calibratedWeight.toFixed(4)),
            win_rate: parseFloat(rawWr.toFixed(2)),
            sample_count: stats.rawTotal,
            trend,
            last_calibrated_at: new Date().toISOString(),
          });
        }

        // Upsert refinement weights
        if (upsertRows.length > 0) {
          const { error: upsertErr } = await supabase
            .from("management_refinement_weights")
            .upsert(upsertRows, { onConflict: "asset,timeframe,indicator_name" });
          if (upsertErr) {
            console.error(`[AUTO-REFINE] Upsert error for ${asset}/${timeframe}:`, upsertErr.message);
          } else {
            results.calibrated += upsertRows.length;
          }
        }

        // ========== THRESHOLD SWEEP OPTIMIZER ==========
        const newWeightMap = new Map<string, number>();
        upsertRows.forEach((r) => newWeightMap.set(r.indicator_name, r.calibrated_weight));

        const allFinalizedArr = allFinalized || [];
        if (allFinalizedArr.length >= 3) {
          const { best, sweep } = findOptimalThreshold(allFinalizedArr, newWeightMap);

          const projectedWR = best.total > 0 ? (best.correct / best.total) * 100 : null;

          // Log calibration run
          const { error: logErr } = await supabase
            .from("management_refinement_log")
            .insert({
              asset,
              timeframe,
              overall_wr_before: parseFloat(overallWRBefore.toFixed(2)),
              overall_wr_after: projectedWR !== null ? parseFloat(projectedWR.toFixed(2)) : parseFloat(overallWRBefore.toFixed(2)),
              indicators_adjusted: adjustments.length,
              adjustments_json: adjustments,
              analysis_count: perfData.length,
              projected_wr_new_weights: projectedWR !== null ? parseFloat(projectedWR.toFixed(2)) : null,
              backtest_signal_changes: best.changes,
              backtest_details: best.details.length > 0 ? best.details : null,
              loss_avoidance_rate: parseFloat(best.lossAvoidanceRate.toFixed(2)),
              missed_opportunity_rate: parseFloat(best.missedOpportunityRate.toFixed(2)),
              effective_threshold: best.threshold,
            });

          if (logErr) console.error(`[AUTO-REFINE] Log error:`, logErr.message);

          results.logs.push({
            asset, timeframe,
            totalIndicators: upsertRows.length,
            adjusted: adjustments.length,
            overallWR: overallWRBefore.toFixed(1),
            projectedWR: projectedWR?.toFixed(1) || "N/A",
            ulTotal: best.ulTotal,
            optimalThreshold: best.threshold,
            signalChanges: best.changes,
            lossAvoidanceRate: best.lossAvoidanceRate.toFixed(1),
            missedOpportunityRate: best.missedOpportunityRate.toFixed(1),
            backtestSamples: best.total,
            samples: perfData.length,
            thresholdSweep: sweep,
          });

          console.log(`[AUTO-REFINE] ✅ ${asset}/${timeframe}: UL=${best.ulTotal} | WR ${overallWRBefore.toFixed(1)}% → ${projectedWR?.toFixed(1) || "N/A"}% | Threshold: ${best.threshold}% | LossAvoid: ${best.lossAvoidanceRate.toFixed(1)}% | MissedOpp: ${best.missedOpportunityRate.toFixed(1)}% | ${best.changes} changes`);
        } else {
          console.log(`[AUTO-REFINE] Skipping backtest for ${asset}/${timeframe}: only ${allFinalizedArr.length} finalized (need 3+)`);
        }
      }
    }

    // ========== RESET MODE ==========
    if (mode === "reset") {
      await supabase.from("management_refinement_weights").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("management_indicator_performance").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      results.logs.push({ action: "RESET", message: "All refinement data cleared" });
      console.log(`[AUTO-REFINE] Reset complete`);
    }

    console.log(`[AUTO-REFINE] Done. Extracted: ${results.extracted}, Calibrated: ${results.calibrated}`);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[AUTO-REFINE] Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
