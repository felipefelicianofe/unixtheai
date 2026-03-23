import { supabase } from "@/integrations/supabase/client";

export interface LiveContext {
  triggerReason?: "candle_close" | "volume_anomaly" | "structure_break" | "manual";
  livePrice?: number;
  volumeMultiple?: number;
  previousSignal?: string;
  rsi1m?: number;
  supportPrice?: number;
  resistancePrice?: number;
}

export interface AnalysisResult {
  header: {
    asset: string;
    timeframe: string;
    signal: "COMPRA" | "VENDA" | "NEUTRO";
    signal_strength_pct: number;
    final_confidence_pct: number;
    trend: "ALTA" | "BAIXA" | "LATERAL";
  };
  risk_management: {
    entry_price: number;
    stop_loss: number;
    take_profit_1: number;
    take_profit_2: number;
    take_profit_3: number;
    risk_reward_ratio: string;
    atr_value: number;
    risk_pct: number;
  };
  technical_indicators: {
    rsi: { value: number; signal: string };
    macd: { value: number; signal_line: number; histogram: number; signal: string };
    adx: { value: number; trend_strength: string };
    ema_20: number;
    ema_50: number;
    ema_200: number;
    bollinger: { upper: number; middle: number; lower: number };
    volume_profile: string;
    mfi: number;
    cci: number;
    stochastic: { k: number; d: number };
    buy_signals: number;
    sell_signals: number;
    neutral_signals: number;
    vwap?: number;
    ichimoku?: { tenkan: number; kijun: number; senkouA: number; senkouB: number; chikou: number; signal: string };
    obv?: number;
    ad_line?: number;
    pivot_points?: { classic: Record<string, number>; fibonacci: Record<string, number>; camarilla: Record<string, number> };
    candle_patterns?: Array<{ name: string; type: string; index: number }>;
    divergences?: Array<{ type: string; indicator: string }>;
    regime?: { regime: string; bandwidth: number };
    confluence?: { buy_score: number; sell_score: number; max_score: number; confidence: number };
  };
  smc_analysis: {
    bias: string;
    order_blocks: Array<{ type: string; price_zone: string; strength: string }>;
    fair_value_gaps: Array<{ direction: string; zone: string }>;
    break_of_structure: string;
    liquidity_zones: Array<{ type: string; price: number }>;
  };
  wegd_analysis: {
    wyckoff_phase: string;
    elliott_wave: string;
    gann_angle: string;
    dow_theory: string;
    confluence_score: string;
  };
  quantitative: {
    monte_carlo_bull_pct: number;
    monte_carlo_bear_pct: number;
    sharpe_ratio: number;
    max_drawdown_pct: number;
    var_95_pct: number;
    sortino_ratio: number;
    win_rate_historical: number;
  };
  sentiment: {
    news_score: number;
    social_score: number;
    overall: string;
    recent_headlines: string[];
  };
  institutional_synthesis: {
    executive_summary: string;
    warning: string;
    best_hours: string[];
  };
  _candles?: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
  _has_real_data?: boolean;
  _data_source?: string;
  _has_real_volume?: boolean;
  _asset_type?: string;
  _data_warnings?: string[];
  _analysis_timestamp?: string;
  _fibonacci?: {
    level_236: number; level_382: number; level_500: number; level_618: number; level_786: number;
    ext_1272: number; ext_1618: number; swingHigh: number; swingLow: number;
    isUptrend: boolean; nearestLevel: string; nearestPrice: number;
  } | null;
  _atr_trailing?: { trailingStop: number; bestTrailingStop: number; multiplier: number };
  _market_session?: { session: string; description: string; volatilityExpectation: string };
  _liquidation_levels?: {
    levels: Array<{ leverage: string; longLiquidation: number; shortLiquidation: number }>;
    nearestLongCluster: number; nearestShortCluster: number;
  } | null;
  _volume_delta?: { buyVolume: number; sellVolume: number; delta: number; ratio: number; pressure: string } | null;
  _fear_greed?: { value: number; classification: string } | null;
  _funding_rate?: number | null;
  _backtest?: { wins: number; losses: number; total: number; winRate: number; avgRR: number };
  _kelly?: { kellyPct: number; halfKellyPct: number; recommendation: string };
  _confidence_decay?: { currentConfidence: number; ageMinutes: number; validity: string };
  _sl_method?: string;
  _htf_bias?: "BUY" | "SELL" | "NEUTRAL" | null;
  _htf_timeframe?: string | null;
  _signal_deterministic?: boolean;
  _rsi_momentum?: { slope: number; direction: string };
  _obv_slope?: { obvTrend: string; obvValue: number; obvEma: number } | null;
  _ema_crossover?: { crossed: boolean; type: string; barsAgo: number };
  _macd_slope?: number;
  _taker_data?: { takerBuyRatio: number; takerBuyVolume: number; totalVolume: number; pressure: string } | null;
  _open_interest?: { oi: number; oiChange: number } | null;
  _atr_percentile?: { percentile: number; classification: string };
  _regime_monte_carlo?: { bullPct: number; bearPct: number; regimeReturns: number };
  _bayesian?: { posterior: number; prior: number; likelihood: number };
  _risk_of_ruin?: { riskOfRuin: number; classification: string; maxConsecutiveLosses: number };
  _scale_out?: { strategy: string; tp1_close_pct: number; tp2_close_pct: number; tp3_close_pct: number; tp1_price: number; tp2_price: number; tp3_price: number; move_sl_to_breakeven_at: number; breakeven_price: number; description: string };
  _harmonic_patterns?: Array<{
    pattern: "GARTLEY" | "BAT" | "CRAB" | "BUTTERFLY" | "SHARK";
    direction: "BULLISH" | "BEARISH";
    completion_pct: number;
    confidence_pct: number;
    prz: string;
  }>;
  _dual_scenarios?: {
    primary_signal: string;
    buy: { probability_pct: number; entry: number; stop_loss: number; take_profit_1: number; take_profit_2: number; take_profit_3: number };
    sell: { probability_pct: number; entry: number; stop_loss: number; take_profit_1: number; take_profit_2: number; take_profit_3: number };
  };
  _monte_carlo_extended?: {
    optimistic_target: number;
    median_target: number;
    pessimistic_target: number;
    horizon_bars: number;
    seasonality: Array<{ month: string; avg_return_pct: number; win_rate_pct: number; samples: number }>;
  } | null;
  _smc_status?: {
    order_blocks: Array<{ type: string; price_zone: string; strength: string; status: "ACTIVE" | "MITIGATED" }>;
    fair_value_gaps: Array<{ direction: string; zone: string; status: "ACTIVE" | "FILLED" }>;
    summary: { active_order_blocks: number; mitigated_order_blocks: number; active_fvgs: number; filled_fvgs: number };
  } | null;
  _master?: {
    verdict: "CONFIRMED" | "DOWNGRADED" | "OVERRIDDEN_TO_NEUTRAL" | "FLAGGED";
    quality_score: number;
    adjustments: string[];
    warnings: string[];
    subsystem_agreement: number;
    original_confidence: number;
    original_signal: string;
  };
}

export async function analyzeAsset(asset: string, timeframe: string, liveContext?: LiveContext): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke("analyze-asset", {
    body: { asset, timeframe, liveContext },
  });

  if (error) {
    throw new Error(error.message || "Erro ao analisar ativo");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as AnalysisResult;
}
