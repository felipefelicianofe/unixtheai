import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================
// TECHNICAL INDICATOR CALCULATIONS (Wilder's Smoothing)
// ============================================================

function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

// WILDER'S RSI — proper smoothed average (matches TradingView)
function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  // First average: simple
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  // Wilder's smoothing for remaining bars
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Wilder's RSI series (for divergence detection)
function calcRSISeries(closes: number[], period = 14): number[] {
  const result: number[] = [];
  if (closes.length < period + 1) return result;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  result.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    result.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
  }
  return result;
}

function calcMACD(closes: number[]): { value: number; signal: number; histogram: number; histogramSlope: number; histogramAccel: number } {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calcEMA(macdLine, 9);
  const last = macdLine.length - 1;
  const hist = macdLine[last] - signalLine[last];
  const prevHist = last > 0 ? macdLine[last - 1] - signalLine[last - 1] : hist;
  const prevPrevHist = last > 1 ? macdLine[last - 2] - signalLine[last - 2] : prevHist;
  // Slope: positive = histogram growing, negative = shrinking
  const histogramSlope = hist - prevHist;
  // Acceleration: is the slope accelerating or decelerating?
  const histogramAccel = (hist - prevHist) - (prevHist - prevPrevHist);
  return { value: macdLine[last], signal: signalLine[last], histogram: hist, histogramSlope, histogramAccel };
}

function calcATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (closes.length < 2) return 0;
  // First TR values
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  if (trs.length < period) return trs.reduce((a, b) => a + b, 0) / trs.length;
  // Wilder's smoothing
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

// WILDER'S ADX — proper DI+/DI-/DX/ADX (matches TradingView)
function calcADX(highs: number[], lows: number[], closes: number[], period = 14): { adx: number; plusDI: number; minusDI: number } {
  if (closes.length < period + 1) return { adx: 0, plusDI: 0, minusDI: 0 };
  
  const trs: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];
  
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  
  // First smoothed values (Wilder's sum)
  let smoothTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  
  const dxValues: number[] = [];
  
  for (let i = period; i < trs.length; i++) {
    smoothTR = smoothTR - smoothTR / period + trs[i];
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDMs[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDMs[i];
    
    const plusDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const minusDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
    dxValues.push(dx);
  }
  
  if (dxValues.length < period) {
    const avgDX = dxValues.reduce((a, b) => a + b, 0) / (dxValues.length || 1);
    const lastPlusDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const lastMinusDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    return { adx: avgDX, plusDI: lastPlusDI, minusDI: lastMinusDI };
  }
  
  // Wilder's smoothed ADX
  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }
  
  const lastPlusDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
  const lastMinusDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
  return { adx, plusDI: lastPlusDI, minusDI: lastMinusDI };
}

function calcSMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1];
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcBollinger(closes: number[], period = 20): { upper: number; middle: number; lower: number } {
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  return { upper: mean + 2 * std, middle: mean, lower: mean - 2 * std };
}

// Williams %R
function calcWilliamsR(highs: number[], lows: number[], closes: number[], period = 14): number {
  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);
  const hh = Math.max(...recentHighs);
  const ll = Math.min(...recentLows);
  if (hh === ll) return -50;
  return ((hh - closes[closes.length - 1]) / (hh - ll)) * -100;
}

// Awesome Oscillator (AO): SMA5(median) - SMA34(median)
function calcAwesomeOscillator(highs: number[], lows: number[]): number {
  const medians = highs.map((h, i) => (h + lows[i]) / 2);
  const sma5 = calcSMA(medians, 5);
  const sma34 = calcSMA(medians, 34);
  return sma5 - sma34;
}

// Momentum (rate of change over N periods)
function calcMomentum(closes: number[], period = 10): number {
  if (closes.length < period + 1) return 0;
  return closes[closes.length - 1] - closes[closes.length - 1 - period];
}

// Stochastic RSI
function calcStochRSI(closes: number[], rsiPeriod = 14, stochPeriod = 14): { k: number; d: number } {
  const rsiSeries = calcRSISeries(closes, rsiPeriod);
  if (rsiSeries.length < stochPeriod) return { k: 50, d: 50 };
  const recentRSI = rsiSeries.slice(-stochPeriod);
  const maxRSI = Math.max(...recentRSI);
  const minRSI = Math.min(...recentRSI);
  const range = maxRSI - minRSI;
  const k = range === 0 ? 50 : ((rsiSeries[rsiSeries.length - 1] - minRSI) / range) * 100;
  // Smooth K over 3 periods for D
  const kValues: number[] = [];
  for (let i = Math.max(0, rsiSeries.length - 3); i < rsiSeries.length; i++) {
    const slice = rsiSeries.slice(Math.max(0, i - stochPeriod + 1), i + 1);
    const mx = Math.max(...slice);
    const mn = Math.min(...slice);
    const r = mx - mn;
    kValues.push(r === 0 ? 50 : ((rsiSeries[i] - mn) / r) * 100);
  }
  const d = kValues.reduce((a, b) => a + b, 0) / kValues.length;
  return { k: parseFloat(k.toFixed(2)), d: parseFloat(d.toFixed(2)) };
}

// Bull Bear Power (Elder)
function calcBullBearPower(highs: number[], lows: number[], closes: number[], period = 13): { bull: number; bear: number } {
  const ema = calcEMA(closes, period);
  const emaVal = ema[ema.length - 1];
  return {
    bull: highs[highs.length - 1] - emaVal,
    bear: lows[lows.length - 1] - emaVal,
  };
}

// Ultimate Oscillator
function calcUltimateOscillator(highs: number[], lows: number[], closes: number[]): number {
  if (closes.length < 29) return 50;
  const bps: number[] = [];
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const bp = closes[i] - Math.min(lows[i], closes[i - 1]);
    const tr = Math.max(highs[i], closes[i - 1]) - Math.min(lows[i], closes[i - 1]);
    bps.push(bp);
    trs.push(tr);
  }
  const sum = (arr: number[], n: number) => arr.slice(-n).reduce((a, b) => a + b, 0);
  const avg7 = sum(bps, 7) / (sum(trs, 7) || 1);
  const avg14 = sum(bps, 14) / (sum(trs, 14) || 1);
  const avg28 = sum(bps, 28) / (sum(trs, 28) || 1);
  return ((4 * avg7 + 2 * avg14 + avg28) / 7) * 100;
}

function calcStochastic(highs: number[], lows: number[], closes: number[], period = 14): { k: number; d: number } {
  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);
  const hh = Math.max(...recentHighs);
  const ll = Math.min(...recentLows);
  const close = closes[closes.length - 1];
  const k = hh === ll ? 50 : ((close - ll) / (hh - ll)) * 100;
  const kValues: number[] = [];
  for (let i = Math.max(0, closes.length - 3); i < closes.length; i++) {
    const rh = highs.slice(Math.max(0, i - period + 1), i + 1);
    const rl = lows.slice(Math.max(0, i - period + 1), i + 1);
    const rHH = Math.max(...rh);
    const rLL = Math.min(...rl);
    kValues.push(rHH === rLL ? 50 : ((closes[i] - rLL) / (rHH - rLL)) * 100);
  }
  const d = kValues.reduce((a, b) => a + b, 0) / kValues.length;
  return { k, d };
}

function calcMFI(highs: number[], lows: number[], closes: number[], volumes: number[], period = 14): number {
  let posFlow = 0, negFlow = 0;
  const start = Math.max(1, closes.length - period);
  for (let i = start; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    const prevTp = (highs[i - 1] + lows[i - 1] + closes[i - 1]) / 3;
    const mf = tp * volumes[i];
    if (tp > prevTp) posFlow += mf; else negFlow += mf;
  }
  if (negFlow === 0) return 100;
  return 100 - (100 / (1 + posFlow / negFlow));
}

function calcCCI(highs: number[], lows: number[], closes: number[], period = 20): number {
  const tps: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    tps.push((highs[i] + lows[i] + closes[i]) / 3);
  }
  const recent = tps.slice(-period);
  const mean = recent.reduce((a, b) => a + b, 0) / period;
  const meanDev = recent.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
  if (meanDev === 0) return 0;
  return (tps[tps.length - 1] - mean) / (0.015 * meanDev);
}

function monteCarloSimulation(closes: number[], simulations = 10000, days = 5): { bullPct: number; bearPct: number } {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const lastPrice = closes[closes.length - 1];

  let bullCount = 0;
  for (let s = 0; s < simulations; s++) {
    let price = lastPrice;
    for (let d = 0; d < days; d++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      price *= (1 + meanReturn + stdDev * z);
    }
    if (price > lastPrice) bullCount++;
  }
  const bullPct = (bullCount / simulations) * 100;
  return { bullPct, bearPct: 100 - bullPct };
}

function calcQuantMetrics(closes: number[]): { sharpe: number; sortino: number; maxDrawdown: number; var95: number; winRate: number } {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const std = Math.sqrt(variance);
  const sharpe = std === 0 ? 0 : (mean / std) * Math.sqrt(252);

  const downside = returns.filter(r => r < 0);
  const downsideVar = downside.length > 0 ? downside.reduce((a, b) => a + b ** 2, 0) / downside.length : 0;
  const sortino = Math.sqrt(downsideVar) === 0 ? 0 : (mean / Math.sqrt(downsideVar)) * Math.sqrt(252);

  const sorted = [...returns].sort((a, b) => a - b);
  const var95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.05)] * 100 : 0;

  let peak = closes[0], maxDD = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    const dd = (peak - c) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  const wins = returns.filter(r => r > 0).length;
  const winRate = returns.length > 0 ? (wins / returns.length) * 100 : 50;

  return { sharpe, sortino, maxDrawdown: maxDD * 100, var95, winRate };
}

// ============================================================
// ADVANCED TA
// ============================================================

function calcVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
  let cumTPV = 0, cumVol = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumTPV += tp * (volumes[i] || 1);
    cumVol += (volumes[i] || 1);
  }
  return cumVol === 0 ? closes[closes.length - 1] : cumTPV / cumVol;
}

function calcIchimoku(highs: number[], lows: number[], closes: number[]) {
  const hh = (arr: number[], p: number, end: number) => {
    const s = arr.slice(Math.max(0, end - p), end);
    return s.length > 0 ? Math.max(...s) : 0;
  };
  const ll = (arr: number[], p: number, end: number) => {
    const s = arr.slice(Math.max(0, end - p), end);
    return s.length > 0 ? Math.min(...s) : 0;
  };
  const n = closes.length;
  const tenkan = (hh(highs, 9, n) + ll(lows, 9, n)) / 2;
  const kijun = (hh(highs, 26, n) + ll(lows, 26, n)) / 2;
  const senkouA = (tenkan + kijun) / 2;
  const senkouB = (hh(highs, 52, n) + ll(lows, 52, n)) / 2;
  const chikou = closes[Math.max(0, n - 26)];
  const price = closes[n - 1];
  const aboveCloud = price > Math.max(senkouA, senkouB);
  const belowCloud = price < Math.min(senkouA, senkouB);
  const signal = aboveCloud ? "BULLISH" : belowCloud ? "BEARISH" : "NEUTRAL";
  return { tenkan, kijun, senkouA, senkouB, chikou, signal };
}

function calcOBV(closes: number[], volumes: number[]): number {
  let obv = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
  }
  return obv;
}

function calcADLine(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
  let ad = 0;
  for (let i = 0; i < closes.length; i++) {
    const range = highs[i] - lows[i];
    if (range === 0) continue;
    const mfm = ((closes[i] - lows[i]) - (highs[i] - closes[i])) / range;
    ad += mfm * (volumes[i] || 1);
  }
  return ad;
}

function calcPivotPoints(high: number, low: number, close: number) {
  const pp = (high + low + close) / 3;
  const classic = {
    pp, r1: 2 * pp - low, s1: 2 * pp - high,
    r2: pp + (high - low), s2: pp - (high - low),
    r3: high + 2 * (pp - low), s3: low - 2 * (high - pp),
  };
  const range = high - low;
  const fib = {
    pp, r1: pp + 0.382 * range, s1: pp - 0.382 * range,
    r2: pp + 0.618 * range, s2: pp - 0.618 * range,
    r3: pp + range, s3: pp - range,
  };
  const cam = {
    pp, r1: close + range * 1.1 / 12, s1: close - range * 1.1 / 12,
    r2: close + range * 1.1 / 6, s2: close - range * 1.1 / 6,
    r3: close + range * 1.1 / 4, s3: close - range * 1.1 / 4,
  };
  return { classic, fibonacci: fib, camarilla: cam };
}

function detectCandlePatterns(opens: number[], closes: number[], highs: number[], lows: number[]) {
  const patterns: Array<{ name: string; type: "BULLISH" | "BEARISH"; index: number }> = [];
  const len = closes.length;
  for (let i = Math.max(2, len - 10); i < len; i++) {
    const body = Math.abs(closes[i] - opens[i]);
    const range = highs[i] - lows[i];
    if (range === 0) continue;
    const bodyRatio = body / range;
    const isBullish = closes[i] > opens[i];
    const upperWick = highs[i] - Math.max(opens[i], closes[i]);
    const lowerWick = Math.min(opens[i], closes[i]) - lows[i];
    if (bodyRatio < 0.1) patterns.push({ name: "DOJI", type: isBullish ? "BULLISH" : "BEARISH", index: i });
    if (lowerWick > body * 2 && upperWick < body * 0.5 && isBullish)
      patterns.push({ name: "HAMMER", type: "BULLISH", index: i });
    if (upperWick > body * 2 && lowerWick < body * 0.5)
      patterns.push({ name: "SHOOTING_STAR", type: "BEARISH", index: i });
    if (i > 0) {
      const prevBody = Math.abs(closes[i - 1] - opens[i - 1]);
      if (isBullish && closes[i - 1] < opens[i - 1] && body > prevBody && closes[i] > opens[i - 1] && opens[i] < closes[i - 1])
        patterns.push({ name: "BULLISH_ENGULFING", type: "BULLISH", index: i });
      if (!isBullish && closes[i - 1] > opens[i - 1] && body > prevBody && closes[i] < opens[i - 1] && opens[i] > closes[i - 1])
        patterns.push({ name: "BEARISH_ENGULFING", type: "BEARISH", index: i });
    }
    if (i >= 2) {
      const firstBearish = closes[i - 2] < opens[i - 2];
      const smallMiddle = Math.abs(closes[i - 1] - opens[i - 1]) / (highs[i - 1] - lows[i - 1] || 1) < 0.3;
      const thirdBullish = closes[i] > opens[i] && closes[i] > (opens[i - 2] + closes[i - 2]) / 2;
      if (firstBearish && smallMiddle && thirdBullish)
        patterns.push({ name: "MORNING_STAR", type: "BULLISH", index: i });
      const firstBullish2 = closes[i - 2] > opens[i - 2];
      const thirdBearish = closes[i] < opens[i] && closes[i] < (opens[i - 2] + closes[i - 2]) / 2;
      if (firstBullish2 && smallMiddle && thirdBearish)
        patterns.push({ name: "EVENING_STAR", type: "BEARISH", index: i });
    }
  }
  return patterns.slice(-6);
}

function detectDivergences(closes: number[], indicator: number[], indicatorName: string) {
  const divs: Array<{ type: "BULLISH" | "BEARISH"; indicator: string }> = [];
  const len = closes.length;
  if (len < 10) return divs;
  const priceHighs: number[] = [], priceLows: number[] = [];
  for (let i = 2; i < len - 2; i++) {
    if (closes[i] > closes[i - 1] && closes[i] > closes[i - 2] && closes[i] > closes[i + 1] && closes[i] > closes[i + 2])
      priceHighs.push(closes[i]);
    if (closes[i] < closes[i - 1] && closes[i] < closes[i - 2] && closes[i] < closes[i + 1] && closes[i] < closes[i + 2])
      priceLows.push(closes[i]);
  }
  if (priceHighs.length >= 2) {
    const ph = priceHighs.slice(-2);
    if (ph[1] > ph[0]) {
      const rsiSlice = indicator.slice(-Math.floor(len / 2));
      const rsiMax1 = Math.max(...rsiSlice.slice(0, Math.floor(rsiSlice.length / 2)));
      const rsiMax2 = Math.max(...rsiSlice.slice(Math.floor(rsiSlice.length / 2)));
      if (rsiMax2 < rsiMax1) divs.push({ type: "BEARISH", indicator: indicatorName });
    }
  }
  if (priceLows.length >= 2) {
    const pl = priceLows.slice(-2);
    if (pl[1] < pl[0]) {
      const rsiSlice = indicator.slice(-Math.floor(len / 2));
      const rsiMin1 = Math.min(...rsiSlice.slice(0, Math.floor(rsiSlice.length / 2)));
      const rsiMin2 = Math.min(...rsiSlice.slice(Math.floor(rsiSlice.length / 2)));
      if (rsiMin2 > rsiMin1) divs.push({ type: "BULLISH", indicator: indicatorName });
    }
  }
  return divs;
}

function detectRegime(adx: number, bbUpper: number, bbLower: number, bbMiddle: number): { regime: "TRENDING" | "RANGING"; bandwidth: number } {
  const bandwidth = bbMiddle !== 0 ? (bbUpper - bbLower) / bbMiddle : 0;
  const regime = adx > 25 && bandwidth > 0.03 ? "TRENDING" : "RANGING";
  return { regime, bandwidth };
}

// ============================================================
// NEW: MOMENTUM SLOPE SIGNALS
// ============================================================

// RSI Momentum: rate of change over last N bars
function calcRSIMomentum(rsiSeries: number[], lookback = 3): { slope: number; direction: "ACCELERATING" | "DECELERATING" | "FLAT" } {
  if (rsiSeries.length < lookback + 1) return { slope: 0, direction: "FLAT" };
  const current = rsiSeries[rsiSeries.length - 1];
  const past = rsiSeries[rsiSeries.length - 1 - lookback];
  const slope = current - past;
  const direction = slope > 2 ? "ACCELERATING" : slope < -2 ? "DECELERATING" : "FLAT";
  return { slope: parseFloat(slope.toFixed(2)), direction };
}

// OBV Slope: compare OBV vs its EMA (trend, not absolute value)
function calcOBVSlope(closes: number[], volumes: number[], emaPeriod = 10): { obvTrend: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL"; obvValue: number; obvEma: number } {
  let obv = 0;
  const obvSeries: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
    obvSeries.push(obv);
  }
  const obvEmaArr = calcEMA(obvSeries, emaPeriod);
  const obvEma = obvEmaArr[obvEmaArr.length - 1];
  const diff = obv - obvEma;
  const threshold = Math.abs(obvEma) * 0.05 || 1;
  const obvTrend = diff > threshold ? "ACCUMULATION" : diff < -threshold ? "DISTRIBUTION" : "NEUTRAL";
  return { obvTrend, obvValue: obv, obvEma: parseFloat(obvEma.toFixed(0)) };
}

// EMA Crossover Detection: did EMA20 cross EMA50 in last N candles?
function detectEMACrossover(ema20: number[], ema50: number[], lookback = 3): { crossed: boolean; type: "GOLDEN_CROSS" | "DEATH_CROSS" | "NONE"; barsAgo: number } {
  const len = Math.min(ema20.length, ema50.length);
  if (len < lookback + 1) return { crossed: false, type: "NONE", barsAgo: 0 };
  
  for (let i = len - 1; i >= len - lookback && i > 0; i--) {
    const prevAbove = ema20[i - 1] > ema50[i - 1];
    const currAbove = ema20[i] > ema50[i];
    if (!prevAbove && currAbove) return { crossed: true, type: "GOLDEN_CROSS", barsAgo: len - 1 - i };
    if (prevAbove && !currAbove) return { crossed: true, type: "DEATH_CROSS", barsAgo: len - 1 - i };
  }
  return { crossed: false, type: "NONE", barsAgo: 0 };
}

// ============================================================
// NEW: PROBABILISTIC ADVANCED
// ============================================================

// ATR Percentile: where is current ATR relative to history?
function calcATRPercentile(highs: number[], lows: number[], closes: number[], period = 14, historyLen = 100): { percentile: number; classification: string } {
  const atrValues: number[] = [];
  for (let end = period + 1; end <= closes.length; end++) {
    const slicedH = highs.slice(0, end);
    const slicedL = lows.slice(0, end);
    const slicedC = closes.slice(0, end);
    const trs: number[] = [];
    for (let i = Math.max(1, slicedC.length - period); i < slicedC.length; i++) {
      trs.push(Math.max(slicedH[i] - slicedL[i], Math.abs(slicedH[i] - slicedC[i - 1]), Math.abs(slicedL[i] - slicedC[i - 1])));
    }
    atrValues.push(trs.reduce((a, b) => a + b, 0) / trs.length);
  }
  
  const recentATRs = atrValues.slice(-historyLen);
  const currentATR = recentATRs[recentATRs.length - 1];
  const sorted = [...recentATRs].sort((a, b) => a - b);
  const rank = sorted.findIndex(v => v >= currentATR);
  const percentile = ((rank + 1) / sorted.length) * 100;
  
  let classification: string;
  if (percentile > 90) classification = "EXTREMA — Cautela máxima, widen stops";
  else if (percentile > 75) classification = "ELEVADA — Volatilidade acima do normal";
  else if (percentile > 25) classification = "NORMAL — Condições típicas";
  else classification = "BAIXA — Compressão, possível expansão iminente";
  
  return { percentile: parseFloat(percentile.toFixed(1)), classification };
}

// Regime-filtered Monte Carlo: only use returns from matching regime
function regimeFilteredMonteCarlo(
  closes: number[], adxValues: number[], bbBandwidths: number[],
  currentRegime: "TRENDING" | "RANGING", simulations = 10000, days = 5
): { bullPct: number; bearPct: number; regimeReturns: number } {
  // Classify each bar's regime
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const adx = i < adxValues.length ? adxValues[i] : 20;
    const bw = i < bbBandwidths.length ? bbBandwidths[i] : 0.03;
    const barRegime = adx > 25 && bw > 0.03 ? "TRENDING" : "RANGING";
    if (barRegime === currentRegime) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }
  
  if (returns.length < 10) {
    // Fallback to all returns
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }
  
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const lastPrice = closes[closes.length - 1];
  
  let bullCount = 0;
  for (let s = 0; s < simulations; s++) {
    let price = lastPrice;
    for (let d = 0; d < days; d++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      price *= (1 + meanReturn + stdDev * z);
    }
    if (price > lastPrice) bullCount++;
  }
  const bullPct = (bullCount / simulations) * 100;
  return { bullPct: parseFloat(bullPct.toFixed(1)), bearPct: parseFloat((100 - bullPct).toFixed(1)), regimeReturns: returns.length };
}

// Bayesian Confidence: Prior (HTF) × Likelihood (LTF confluence) → Posterior
function calcBayesianConfidence(
  ltfConfidence: number,         // 0-100 from confluence
  htfBias: "BUY" | "SELL" | "NEUTRAL" | null,
  signalDirection: "COMPRA" | "VENDA" | "NEUTRO",
  backtestWinRate: number        // 0-100
): { posterior: number; prior: number; likelihood: number } {
  // Prior: P(signal correct) from HTF
  let prior = 0.5;
  if (htfBias === "BUY" && signalDirection === "COMPRA") prior = 0.65;
  else if (htfBias === "SELL" && signalDirection === "VENDA") prior = 0.65;
  else if (htfBias === "BUY" && signalDirection === "VENDA") prior = 0.25;
  else if (htfBias === "SELL" && signalDirection === "COMPRA") prior = 0.25;
  else if (htfBias === "NEUTRAL") prior = 0.50;
  
  // Likelihood: P(data | signal correct) from LTF indicators
  const likelihood = ltfConfidence / 100;
  
  // Evidence: P(data) = P(data|correct)*P(correct) + P(data|wrong)*P(wrong)
  const pDataGivenWrong = 1 - likelihood;
  const evidence = likelihood * prior + pDataGivenWrong * (1 - prior);
  
  // Posterior: P(correct | data)
  let posterior = evidence > 0 ? (likelihood * prior) / evidence : prior;
  
  // Adjust by backtest evidence — 85% Bayesian, 15% empirical (less backtest drag)
  const backtestFactor = backtestWinRate / 100;
  posterior = posterior * 0.85 + backtestFactor * 0.15;
  
  return {
    posterior: parseFloat((posterior * 100).toFixed(1)),
    prior: parseFloat((prior * 100).toFixed(1)),
    likelihood: parseFloat((likelihood * 100).toFixed(1)),
  };
}

// Regime-filtered backtest
function regimeFilteredBacktest(
  opens: number[], closes: number[], highs: number[], lows: number[],
  signal: string, slDistance: number, currentRegime: "TRENDING" | "RANGING",
  adxValues: number[], bbBandwidths: number[], lookForward = 10
): { wins: number; losses: number; total: number; winRate: number; avgRR: number; tp1Hits: number; tp2Hits: number; tp3Hits: number } {
  const entryDir = signal === "COMPRA" ? 1 : -1;
  let wins = 0, losses = 0, total = 0, tp1Hits = 0, tp2Hits = 0, tp3Hits = 0;
  
  for (let i = 20; i < closes.length - lookForward; i++) {
    // Only test in same regime
    const barADX = i < adxValues.length ? adxValues[i] : 20;
    const barBW = i < bbBandwidths.length ? bbBandwidths[i] : 0.03;
    const barRegime = barADX > 25 && barBW > 0.03 ? "TRENDING" : "RANGING";
    if (barRegime !== currentRegime) continue;
    
    const entry = closes[i];
    const sl = entry - entryDir * slDistance;
    const tp1 = entry + entryDir * slDistance;
    const tp2 = entry + entryDir * slDistance * 2;
    const tp3 = entry + entryDir * slDistance * 3;
    
    let hitSL = false, hitTP1 = false, hitTP2 = false, hitTP3 = false;
    for (let j = i + 1; j <= i + lookForward && !hitSL; j++) {
      if (j >= closes.length) break;
      if (entryDir > 0) {
        if (lows[j] <= sl) { hitSL = true; break; }
        if (highs[j] >= tp1 && !hitTP1) hitTP1 = true;
        if (highs[j] >= tp2 && !hitTP2) hitTP2 = true;
        if (highs[j] >= tp3 && !hitTP3) hitTP3 = true;
      } else {
        if (highs[j] >= sl) { hitSL = true; break; }
        if (lows[j] <= tp1 && !hitTP1) hitTP1 = true;
        if (lows[j] <= tp2 && !hitTP2) hitTP2 = true;
        if (lows[j] <= tp3 && !hitTP3) hitTP3 = true;
      }
    }
    if (hitSL) { losses++; total++; }
    else if (hitTP1) { wins++; total++; if (hitTP1) tp1Hits++; if (hitTP2) tp2Hits++; if (hitTP3) tp3Hits++; }
  }
  
  const winRate = total > 0 ? (wins / total) * 100 : 50;
  const avgRR = losses > 0 ? wins / losses : (wins > 0 ? 3 : 1);
  return { wins, losses, total, winRate: parseFloat(winRate.toFixed(1)), avgRR: parseFloat(avgRR.toFixed(2)), tp1Hits, tp2Hits, tp3Hits };
}

// ============================================================
// NEW: REAL BINANCE DATA (Taker Buy Volume, Open Interest)
// ============================================================

// Fetch Open Interest from Binance Futures
async function fetchOpenInterest(symbol: string): Promise<{ oi: number; oiChange: number } | null> {
  try {
    const res = await fetchWithRetry(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`);
    if (!res) return null;
    const data = await res.json();
    const oi = parseFloat(data.openInterest);
    if (isNaN(oi)) return null;
    // Get historical OI for change calculation
    try {
      const histRes = await fetchWithRetry(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=2`);
      if (histRes) {
        const histData = await histRes.json();
        if (Array.isArray(histData) && histData.length >= 2) {
          const prevOI = parseFloat(histData[0].sumOpenInterest);
          const currOI = parseFloat(histData[1].sumOpenInterest);
          const oiChange = prevOI > 0 ? ((currOI - prevOI) / prevOI) * 100 : 0;
          return { oi: currOI, oiChange: parseFloat(oiChange.toFixed(2)) };
        }
      }
    } catch (e) {
      console.warn(`[OI] Error fetching history: ${e}`);
    }
    return { oi, oiChange: 0 };
  } catch (e) {
    console.warn(`[OI] Fatal error: ${e}`);
    return null;
  }
}

// Real Taker Buy Volume from Binance klines (column 9)
function calcRealTakerVolume(klines: unknown[]): { takerBuyRatio: number; takerBuyVolume: number; totalVolume: number; pressure: string } | null {
  if (!klines || klines.length === 0) return null;
  let totalVol = 0, takerBuyVol = 0;
  // Use last 20 candles for recent pressure
  const recent = klines.slice(-20);
  for (const k of recent) {
    if (!Array.isArray(k)) continue;
    const vol = parseFloat(String(k[5])); // Total volume
    const tbv = parseFloat(String(k[9])); // Taker buy base asset volume
    if (!isNaN(vol) && !isNaN(tbv)) {
      totalVol += vol;
      takerBuyVol += tbv;
    }
  }
  if (totalVol === 0) return null;
  const ratio = takerBuyVol / totalVol;
  const pressure = ratio > 0.55 ? "COMPRADORES_AGRESSIVOS" : ratio < 0.45 ? "VENDEDORES_AGRESSIVOS" : "EQUILIBRADO";
  return {
    takerBuyRatio: parseFloat(ratio.toFixed(4)),
    takerBuyVolume: parseFloat(takerBuyVol.toFixed(0)),
    totalVolume: parseFloat(totalVol.toFixed(0)),
    pressure,
  };
}

// ============================================================
// NEW: PROFESSIONAL RISK MANAGEMENT
// ============================================================

// Risk of Ruin: probability of going broke given win rate and risk per trade
function calcRiskOfRuin(winRate: number, riskPct: number, avgRR: number): { riskOfRuin: number; classification: string; maxConsecutiveLosses: number } {
  const w = winRate / 100;
  const l = 1 - w;
  
  // Simplified Risk of Ruin formula: RoR = ((1-edge)/((1+edge)))^(units)
  // where edge = w*avgRR - l, units = capital/risk
  const edge = w * avgRR - l;
  const units = 100 / riskPct; // How many losses to ruin
  
  let riskOfRuin: number;
  if (edge <= 0) {
    riskOfRuin = 100; // Negative edge = guaranteed ruin eventually
  } else {
    // RoR = ((q/p))^N where p = prob of winning a unit, q = 1-p
    const p = w;
    const q = l;
    if (p === 0) { riskOfRuin = 100; }
    else {
      const ratio = q / p;
      riskOfRuin = Math.min(100, Math.pow(ratio, units) * 100);
    }
  }
  
  // Max consecutive losses before hitting drawdown limit
  const maxConsecutiveLosses = Math.floor(Math.log(0.5) / Math.log(l)); // 50% chance of this streak
  
  let classification: string;
  if (riskOfRuin > 50) classification = "CRÍTICO — Risco de ruína alto. REDUZA position size!";
  else if (riskOfRuin > 20) classification = "ELEVADO — Considere Half-Kelly ou menos";
  else if (riskOfRuin > 5) classification = "MODERADO — Aceitável para traders disciplinados";
  else classification = "BAIXO — Risco de ruína controlado";
  
  return { riskOfRuin: parseFloat(riskOfRuin.toFixed(2)), classification, maxConsecutiveLosses };
}

// Scale-out strategy recommendation
function calcScaleOutStrategy(slDistance: number, currentPrice: number, signal: "COMPRA" | "VENDA" | "NEUTRO") {
  const dir = signal === "COMPRA" ? 1 : -1;
  const tp1 = currentPrice + dir * slDistance;
  const tp2 = currentPrice + dir * slDistance * 2;
  const tp3 = currentPrice + dir * slDistance * 3;
  // True Breakeven: entry ± 0.12% (Taker open + Taker close + slippage buffer)
  // This ensures a STOP_MARKET close at breakeven = zero P&L (not a loss)
  const TRUE_BE_RATE = 0.0012;
  const breakevenAfterTP1 = signal === "COMPRA"
    ? currentPrice * (1 + TRUE_BE_RATE)
    : currentPrice * (1 - TRUE_BE_RATE);
  
  return {
    strategy: "SCALE_OUT_50_30_20",
    tp1_close_pct: 50,
    tp2_close_pct: 30,
    tp3_close_pct: 20,
    tp1_price: parseFloat(tp1.toFixed(6)),
    tp2_price: parseFloat(tp2.toFixed(6)),
    tp3_price: parseFloat(tp3.toFixed(6)),
    move_sl_to_breakeven_at: parseFloat(tp1.toFixed(6)),
    breakeven_price: parseFloat(breakevenAfterTP1.toFixed(6)),
    description: `Feche 50% no TP1 ($${tp1.toFixed(2)}), mova SL para breakeven ($${breakevenAfterTP1.toFixed(2)}). Feche 30% no TP2 ($${tp2.toFixed(2)}). Runner 20% no TP3 ($${tp3.toFixed(2)}).`,
  };
}

// ADX series for regime-filtered backtest
function calcADXSeries(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const result: number[] = [];
  for (let end = period * 2 + 1; end <= closes.length; end++) {
    const h = highs.slice(0, end);
    const l = lows.slice(0, end);
    const c = closes.slice(0, end);
    const r = calcADX(h, l, c, period);
    result.push(r.adx);
  }
  return result;
}

// Bollinger bandwidth series
function calcBBBandwidthSeries(closes: number[], period = 20): number[] {
  const result: number[] = [];
  for (let end = period; end <= closes.length; end++) {
    const slice = closes.slice(end - period, end);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    const upper = mean + 2 * std;
    const lower = mean - 2 * std;
    result.push(mean !== 0 ? (upper - lower) / mean : 0);
  }
  return result;
}

// ============================================================
// CONFLUENCE ENGINE — DETERMINISTIC SIGNAL
// ============================================================

interface WeightedSignal {
  name: string;
  direction: "BUY" | "SELL" | "NEUTRAL";
  weight: number;
  tier: number; // 1-6
}

interface ConfluenceResult {
  totalBuy: number;
  totalSell: number;
  totalNeutral: number;
  maxWeight: number;
  confidence: number;
  signal: "COMPRA" | "VENDA" | "NEUTRO";
  signalStrength: number;
  tier1Direction: "BUY" | "SELL" | "NEUTRAL";
  tier2Direction: "BUY" | "SELL" | "NEUTRAL";
  htfAgreement: boolean;
}

function calcDeterministicSignal(
  signals: WeightedSignal[],
  htfBias: "BUY" | "SELL" | "NEUTRAL" | null
): ConfluenceResult {
  let totalBuy = 0, totalSell = 0, totalNeutral = 0, maxWeight = 0;
  let tier1Buy = 0, tier1Sell = 0, tier1Total = 0;
  let tier2Buy = 0, tier2Sell = 0, tier2Total = 0;

  signals.forEach(s => {
    maxWeight += s.weight;
    if (s.direction === "BUY") totalBuy += s.weight;
    else if (s.direction === "SELL") totalSell += s.weight;
    else totalNeutral += s.weight;

    if (s.tier === 1) {
      tier1Total += s.weight;
      if (s.direction === "BUY") tier1Buy += s.weight;
      else if (s.direction === "SELL") tier1Sell += s.weight;
    }
    if (s.tier === 2) {
      tier2Total += s.weight;
      if (s.direction === "BUY") tier2Buy += s.weight;
      else if (s.direction === "SELL") tier2Sell += s.weight;
    }
  });

  const tier1Direction: "BUY" | "SELL" | "NEUTRAL" = 
    tier1Buy > tier1Sell * 1.2 ? "BUY" : 
    tier1Sell > tier1Buy * 1.2 ? "SELL" : "NEUTRAL";
  
  const tier2Direction: "BUY" | "SELL" | "NEUTRAL" = 
    tier2Buy > tier2Sell * 1.2 ? "BUY" : 
    tier2Sell > tier2Buy * 1.2 ? "SELL" : "NEUTRAL";

  // === DETERMINISTIC SIGNAL LOGIC ===
  const buyPct = maxWeight > 0 ? (totalBuy / maxWeight) * 100 : 50;
  const sellPct = maxWeight > 0 ? (totalSell / maxWeight) * 100 : 50;
  const netScore = totalBuy - totalSell;
  const dominantPct = Math.max(buyPct, sellPct);
  
  // Minimum threshold for non-neutral: dominant side must have >50% weight
  // (Raised from 45% to improve signal quality and reduce noise)
  let rawSignal: "BUY" | "SELL" | "NEUTRAL";
  if (dominantPct < 50) {
    rawSignal = "NEUTRAL";
  } else if (totalBuy > totalSell) {
    rawSignal = "BUY";
  } else {
    rawSignal = "SELL";
  }

  // HTF filter: penalize confidence instead of forcing NEUTRAL
  let htfAgreement = true;
  let confidence = dominantPct;

  // Tier 1 structure HARD GATE: if structure disagrees, force NEUTRAL
  if (rawSignal !== "NEUTRAL") {
    if ((rawSignal === "BUY" && tier1Direction === "SELL") || (rawSignal === "SELL" && tier1Direction === "BUY")) {
      console.log(`[SIGNAL] Tier1 VETO: ${rawSignal} but structure is ${tier1Direction}. Forcing NEUTRAL.`);
      rawSignal = "NEUTRAL";
    }
  }
  
  if (htfBias && htfBias !== "NEUTRAL" && rawSignal !== "NEUTRAL") {
    if ((rawSignal === "BUY" && htfBias === "SELL") || (rawSignal === "SELL" && htfBias === "BUY")) {
      // HTF disagrees — penalize 30% instead of forcing NEUTRAL
      htfAgreement = false;
      confidence *= 0.70;
      console.log(`[SIGNAL] HTF penalty: ${rawSignal} but HTF is ${htfBias}. Confidence reduced to ${confidence.toFixed(1)}%.`);
    } else if ((rawSignal === "BUY" && htfBias === "BUY") || (rawSignal === "SELL" && htfBias === "SELL")) {
      // HTF confirms — boost confidence
      htfAgreement = true;
      confidence = Math.min(confidence * 1.15, 95);
      console.log(`[SIGNAL] HTF CONFIRMS: ${rawSignal} aligned with HTF ${htfBias}. Boosted.`);
    }
  }

  // Divergence penalty: if divergence is present against signal, reduce confidence
  const divSignals = signals.filter(s => s.name.startsWith("DIV_"));
  for (const d of divSignals) {
    if ((rawSignal === "BUY" && d.direction === "SELL") || (rawSignal === "SELL" && d.direction === "BUY")) {
      confidence *= 0.85; // 15% penalty per opposing divergence
    }
  }

  // Unanimity penalty: if >85% trend-followers agree, possible exhaustion
  if (rawSignal !== "NEUTRAL") {
    const trendFollowers = signals.filter(s => [1, 2].includes(s.tier) && s.direction !== "NEUTRAL");
    if (trendFollowers.length > 0) {
      const dominantCount = trendFollowers.filter(s => s.direction === rawSignal).length;
      const unanimityPct = (dominantCount / trendFollowers.length) * 100;
      if (unanimityPct > 85) {
        confidence *= 0.85;
        console.log(`[SIGNAL] Unanimity penalty: ${unanimityPct.toFixed(0)}% trend-followers agree → possible exhaustion. Confidence reduced.`);
      }
    }
  }

  // Signal strength: how dominant is the winning side (excluding neutral weights from denominator)
  const activeWeight = totalBuy + totalSell;
  const signalStrength = activeWeight > 0 ? (Math.abs(netScore) / activeWeight) * 100 : 0;

  const signal: "COMPRA" | "VENDA" | "NEUTRO" = 
    rawSignal === "BUY" ? "COMPRA" : rawSignal === "SELL" ? "VENDA" : "NEUTRO";

  return {
    totalBuy: parseFloat(totalBuy.toFixed(1)),
    totalSell: parseFloat(totalSell.toFixed(1)),
    totalNeutral: parseFloat(totalNeutral.toFixed(1)),
    maxWeight: parseFloat(maxWeight.toFixed(1)),
    confidence: parseFloat(Math.min(confidence, 95).toFixed(1)),
    signal,
    signalStrength: parseFloat(signalStrength.toFixed(1)),
    tier1Direction,
    tier2Direction,
    htfAgreement,
  };
}

// ============================================================
// STRUCTURAL STOP LOSS
// ============================================================

interface SwingPoint { index: number; price: number; type: "high" | "low" }

function detectSwingPoints(highs: number[], lows: number[], lookback = 3): SwingPoint[] {
  const points: SwingPoint[] = [];
  for (let i = lookback; i < highs.length - lookback; i++) {
    const leftHighs = highs.slice(i - lookback, i);
    const rightHighs = highs.slice(i + 1, i + 1 + lookback);
    if (leftHighs.every(h => highs[i] > h) && rightHighs.every(h => highs[i] > h)) {
      points.push({ index: i, price: highs[i], type: "high" });
    }
    const leftLows = lows.slice(i - lookback, i);
    const rightLows = lows.slice(i + 1, i + 1 + lookback);
    if (leftLows.every(l => lows[i] < l) && rightLows.every(l => lows[i] < l)) {
      points.push({ index: i, price: lows[i], type: "low" });
    }
  }
  return points.sort((a, b) => a.index - b.index);
}

function calcStructuralSL(
  signal: "COMPRA" | "VENDA" | "NEUTRO",
  currentPrice: number,
  atr: number,
  swingPoints: SwingPoint[],
  orderBlocks: Array<{ type: string; price_zone: string }>
): { stopLoss: number; method: string } {
  const atrMargin = atr * 0.3; // Small margin beyond structure

  if (signal === "COMPRA") {
    // Find nearest swing low BELOW current price
    const swingLows = swingPoints
      .filter(p => p.type === "low" && p.price < currentPrice)
      .sort((a, b) => b.price - a.price); // Nearest first
    
    // Find nearest demand OB below price
    const demandOBs = orderBlocks
      .filter(ob => ob.type === "DEMAND")
      .map(ob => {
        const [low] = ob.price_zone.split("-").map(Number);
        return low;
      })
      .filter(p => p > 0 && p < currentPrice)
      .sort((a, b) => b - a);
    
    // Choose the HIGHEST (nearest) structural level
    const candidates: Array<{ price: number; method: string }> = [];
    if (swingLows.length > 0) candidates.push({ price: swingLows[0].price - atrMargin, method: "Swing Low" });
    if (demandOBs.length > 0) candidates.push({ price: demandOBs[0] - atrMargin, method: "Order Block" });
    
    if (candidates.length > 0) {
      // Pick the nearest one (highest price = tightest SL)
      candidates.sort((a, b) => b.price - a.price);
      const best = candidates[0];
      // But ensure minimum distance of 0.8×ATR
      const minSL = currentPrice - 0.8 * atr;
      if (best.price > minSL) {
        return { stopLoss: parseFloat(minSL.toFixed(6)), method: `${best.method} (too tight, ATR floor)` };
      }
      // And maximum distance of 3×ATR
      const maxSL = currentPrice - 3 * atr;
      if (best.price < maxSL) {
        return { stopLoss: parseFloat(maxSL.toFixed(6)), method: `${best.method} (too far, ATR cap)` };
      }
      return { stopLoss: parseFloat(best.price.toFixed(6)), method: best.method };
    }
    // Fallback to ATR-based
    return { stopLoss: parseFloat((currentPrice - 1.5 * atr).toFixed(6)), method: "ATR (no structure)" };

  } else if (signal === "VENDA") {
    const swingHighs = swingPoints
      .filter(p => p.type === "high" && p.price > currentPrice)
      .sort((a, b) => a.price - b.price);
    
    const supplyOBs = orderBlocks
      .filter(ob => ob.type === "SUPPLY")
      .map(ob => {
        const parts = ob.price_zone.split("-").map(Number);
        return parts[1] || parts[0];
      })
      .filter(p => p > 0 && p > currentPrice)
      .sort((a, b) => a - b);
    
    const candidates: Array<{ price: number; method: string }> = [];
    if (swingHighs.length > 0) candidates.push({ price: swingHighs[0].price + atrMargin, method: "Swing High" });
    if (supplyOBs.length > 0) candidates.push({ price: supplyOBs[0] + atrMargin, method: "Order Block" });
    
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.price - b.price);
      const best = candidates[0];
      const minSL = currentPrice + 0.8 * atr;
      if (best.price < minSL) {
        return { stopLoss: parseFloat(minSL.toFixed(6)), method: `${best.method} (too tight, ATR floor)` };
      }
      const maxSL = currentPrice + 3 * atr;
      if (best.price > maxSL) {
        return { stopLoss: parseFloat(maxSL.toFixed(6)), method: `${best.method} (too far, ATR cap)` };
      }
      return { stopLoss: parseFloat(best.price.toFixed(6)), method: best.method };
    }
    return { stopLoss: parseFloat((currentPrice + 1.5 * atr).toFixed(6)), method: "ATR (no structure)" };
  }

  // NEUTRO — still provide a reference
  return { stopLoss: parseFloat((currentPrice - 1.5 * atr).toFixed(6)), method: "ATR (neutral)" };
}

// ============================================================
// REALISTIC BACKTEST — matches actual TP/SL ratios
// ============================================================

function realisticBacktest(
  opens: number[], closes: number[], highs: number[], lows: number[],
  signal: string, slDistance: number, lookForward = 10
): { wins: number; losses: number; total: number; winRate: number; avgRR: number; tp1Hits: number; tp2Hits: number; tp3Hits: number } {
  const entryDir = signal === "COMPRA" ? 1 : -1;
  const tp1Dist = slDistance * 1; // 1:1
  const tp2Dist = slDistance * 2; // 1:2
  const tp3Dist = slDistance * 3; // 1:3
  
  let wins = 0, losses = 0, total = 0;
  let tp1Hits = 0, tp2Hits = 0, tp3Hits = 0;
  
  for (let i = 20; i < closes.length - lookForward; i++) {
    const entry = closes[i];
    const sl = entry - entryDir * slDistance;
    const tp1 = entry + entryDir * tp1Dist;
    const tp2 = entry + entryDir * tp2Dist;
    const tp3 = entry + entryDir * tp3Dist;
    
    let hitSL = false, hitTP1 = false, hitTP2 = false, hitTP3 = false;
    
    for (let j = i + 1; j <= i + lookForward && !hitSL; j++) {
      if (j >= closes.length) break;
      
      if (entryDir > 0) {
        if (lows[j] <= sl) { hitSL = true; break; }
        if (highs[j] >= tp1 && !hitTP1) hitTP1 = true;
        if (highs[j] >= tp2 && !hitTP2) hitTP2 = true;
        if (highs[j] >= tp3 && !hitTP3) hitTP3 = true;
      } else {
        if (highs[j] >= sl) { hitSL = true; break; }
        if (lows[j] <= tp1 && !hitTP1) hitTP1 = true;
        if (lows[j] <= tp2 && !hitTP2) hitTP2 = true;
        if (lows[j] <= tp3 && !hitTP3) hitTP3 = true;
      }
    }
    
    if (hitSL) {
      losses++;
      total++;
    } else if (hitTP1) {
      wins++;
      total++;
      if (hitTP1) tp1Hits++;
      if (hitTP2) tp2Hits++;
      if (hitTP3) tp3Hits++;
    }
    // If neither hit, skip (no result)
  }
  
  const winRate = total > 0 ? (wins / total) * 100 : 50;
  const avgRR = losses > 0 ? wins / losses : (wins > 0 ? 3 : 1);
  
  return {
    wins, losses, total,
    winRate: parseFloat(winRate.toFixed(1)),
    avgRR: parseFloat(avgRR.toFixed(2)),
    tp1Hits, tp2Hits, tp3Hits
  };
}

// ============================================================
// OTHER FEATURES
// ============================================================

function calcFibonacci(swingPoints: SwingPoint[], currentPrice: number) {
  const highs = swingPoints.filter(p => p.type === "high");
  const lows = swingPoints.filter(p => p.type === "low");
  if (highs.length === 0 || lows.length === 0) return null;
  const swingHigh = highs[highs.length - 1].price;
  const swingLow = lows[lows.length - 1].price;
  const range = swingHigh - swingLow;
  if (range <= 0) return null;
  const isUptrend = highs[highs.length - 1].index > lows[lows.length - 1].index;
  const levels = {
    level_0: swingHigh,
    level_236: swingHigh - range * 0.236,
    level_382: swingHigh - range * 0.382,
    level_500: swingHigh - range * 0.500,
    level_618: swingHigh - range * 0.618,
    level_786: swingHigh - range * 0.786,
    level_100: swingLow,
    ext_1272: isUptrend ? swingHigh + range * 0.272 : swingLow - range * 0.272,
    ext_1618: isUptrend ? swingHigh + range * 0.618 : swingLow - range * 0.618,
  };
  const allLevels = Object.entries(levels).map(([k, v]) => ({ name: k, price: v, dist: Math.abs(v - currentPrice) }));
  allLevels.sort((a, b) => a.dist - b.dist);
  const nearest = allLevels[0];
  return { ...levels, swingHigh, swingLow, isUptrend, nearestLevel: nearest.name, nearestPrice: nearest.price };
}

function calcATRTrailingStop(closes: number[], highs: number[], lows: number[], signal: string, atr: number, multiplier = 2.5) {
  const currentPrice = closes[closes.length - 1];
  const trailingStop = signal === "COMPRA"
    ? currentPrice - multiplier * atr
    : currentPrice + multiplier * atr;
  // Calculate where trailing stop would have been for the last 10 candles
  const trailHistory: number[] = [];
  for (let i = Math.max(0, closes.length - 10); i < closes.length; i++) {
    trailHistory.push(signal === "COMPRA" ? closes[i] - multiplier * atr : closes[i] + multiplier * atr);
  }
  // Best trailing stop = highest (for long) or lowest (for short) in history
  const bestTrail = signal === "COMPRA" ? Math.max(...trailHistory) : Math.min(...trailHistory);
  return { trailingStop: parseFloat(trailingStop.toFixed(6)), bestTrailingStop: parseFloat(bestTrail.toFixed(6)), multiplier };
}

function detectMarketSession(): { session: string; description: string; volatilityExpectation: string } {
  const now = new Date();
  const utcHour = now.getUTCHours();
  if (utcHour >= 0 && utcHour < 8) return { session: "TOKYO", description: "Sessão de Tóquio (Asian)", volatilityExpectation: "BAIXA — Consolidação típica" };
  if (utcHour >= 7 && utcHour < 12) return { session: "LONDON_OPEN", description: "Abertura de Londres", volatilityExpectation: "ALTA — Espere expansão de volatilidade" };
  if (utcHour >= 12 && utcHour < 17) return { session: "NEW_YORK", description: "Nova York + Londres overlap", volatilityExpectation: "MÁXIMA — Maior liquidez do dia" };
  if (utcHour >= 17 && utcHour < 21) return { session: "NEW_YORK_PM", description: "Nova York tarde", volatilityExpectation: "MODERADA — Volumes caindo" };
  return { session: "OFF_HOURS", description: "Fora de horário principal", volatilityExpectation: "MÍNIMA — Cuidado com spreads" };
}

function estimateLiquidationLevels(currentPrice: number, atr: number, signal: string) {
  const levels: Array<{ leverage: string; longLiquidation: number; shortLiquidation: number }> = [
    { leverage: "5x", longLiquidation: currentPrice * 0.80, shortLiquidation: currentPrice * 1.20 },
    { leverage: "10x", longLiquidation: currentPrice * 0.90, shortLiquidation: currentPrice * 1.10 },
    { leverage: "20x", longLiquidation: currentPrice * 0.95, shortLiquidation: currentPrice * 1.05 },
    { leverage: "50x", longLiquidation: currentPrice * 0.98, shortLiquidation: currentPrice * 1.02 },
    { leverage: "100x", longLiquidation: currentPrice * 0.99, shortLiquidation: currentPrice * 1.01 },
  ];
  const nearestLongCluster = currentPrice - 2 * atr;
  const nearestShortCluster = currentPrice + 2 * atr;
  return { levels, nearestLongCluster: parseFloat(nearestLongCluster.toFixed(2)), nearestShortCluster: parseFloat(nearestShortCluster.toFixed(2)) };
}

function calcVolumeDelta(opens: number[], closes: number[], volumes: number[]) {
  let buyVol = 0, sellVol = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!volumes[i] || volumes[i] === 0) continue;
    const range = Math.abs(closes[i] - opens[i]);
    const fullRange = range > 0 ? range : 1;
    const buyRatio = closes[i] >= opens[i] ? 0.6 + (range / fullRange) * 0.2 : 0.4 - (range / fullRange) * 0.2;
    buyVol += volumes[i] * buyRatio;
    sellVol += volumes[i] * (1 - buyRatio);
  }
  const delta = buyVol - sellVol;
  const ratio = sellVol > 0 ? buyVol / sellVol : 1;
  const pressure = ratio > 1.2 ? "COMPRADORES" : ratio < 0.8 ? "VENDEDORES" : "EQUILIBRADO";
  return { buyVolume: parseFloat(buyVol.toFixed(0)), sellVolume: parseFloat(sellVol.toFixed(0)), delta: parseFloat(delta.toFixed(0)), ratio: parseFloat(ratio.toFixed(2)), pressure };
}

function calcConfidenceDecay(analysisTimestamp: string, baseConfidence: number): { currentConfidence: number; ageMinutes: number; validity: string } {
  const ageMs = Date.now() - new Date(analysisTimestamp).getTime();
  const ageMinutes = ageMs / 60000;
  const decayFactor = Math.exp(-0.008 * ageMinutes);
  const currentConfidence = baseConfidence * decayFactor;
  const validity = ageMinutes < 5 ? "FRESCA" : ageMinutes < 15 ? "VÁLIDA" : ageMinutes < 60 ? "ENVELHECENDO" : "EXPIRADA";
  return { currentConfidence: parseFloat(currentConfidence.toFixed(1)), ageMinutes: parseFloat(ageMinutes.toFixed(0)), validity };
}

function calcKellyCriterion(winRate: number, avgWinLossRatio: number): { kellyPct: number; halfKellyPct: number; recommendation: string } {
  const w = winRate / 100;
  const r = avgWinLossRatio;
  const kelly = w - (1 - w) / r;
  const kellyPct = Math.max(0, Math.min(kelly * 100, 25));
  const halfKelly = kellyPct / 2;
  let recommendation: string;
  if (kellyPct <= 0) recommendation = "NÃO OPERE — Edge negativo";
  else if (halfKelly < 1) recommendation = `Aloque no máximo ${halfKelly.toFixed(1)}% (micro posição)`;
  else if (halfKelly < 3) recommendation = `Aloque no máximo ${halfKelly.toFixed(1)}% do capital`;
  else if (halfKelly < 5) recommendation = `Aloque ${halfKelly.toFixed(1)}% — posição moderada`;
  else recommendation = `Aloque ${halfKelly.toFixed(1)}% — posição agressiva (cuidado!)`;
  return { kellyPct: parseFloat(kellyPct.toFixed(1)), halfKellyPct: parseFloat(halfKelly.toFixed(1)), recommendation };
}

function detectOrderBlocks(opens: number[], closes: number[], highs: number[], lows: number[]) {
  const blocks: Array<{ type: string; price_zone: string; strength: string; index: number }> = [];
  const len = closes.length;
  for (let i = Math.max(2, len - 20); i < len - 1; i++) {
    const bodySize = Math.abs(closes[i] - opens[i]);
    const candleRange = highs[i] - lows[i];
    if (candleRange === 0) continue;
    const bodyRatio = bodySize / candleRange;
    if (closes[i] < opens[i] && bodyRatio > 0.5) {
      if (closes[i + 1] > opens[i + 1] && closes[i + 1] > highs[i]) {
        blocks.push({
          type: "DEMAND",
          price_zone: `${lows[i].toFixed(2)}-${highs[i].toFixed(2)}`,
          strength: bodyRatio > 0.7 ? "FORTE" : "MODERADA",
          index: i,
        });
      }
    }
    if (closes[i] > opens[i] && bodyRatio > 0.5) {
      if (closes[i + 1] < opens[i + 1] && closes[i + 1] < lows[i]) {
        blocks.push({
          type: "SUPPLY",
          price_zone: `${lows[i].toFixed(2)}-${highs[i].toFixed(2)}`,
          strength: bodyRatio > 0.7 ? "FORTE" : "MODERADA",
          index: i,
        });
      }
    }
  }
  return blocks.slice(-4);
}

function detectFVGs(highs: number[], lows: number[]) {
  const gaps: Array<{ direction: string; zone: string; index: number }> = [];
  const len = highs.length;
  for (let i = Math.max(2, len - 20); i < len; i++) {
    if (lows[i] > highs[i - 2]) {
      gaps.push({ direction: "BULLISH", zone: `${highs[i - 2].toFixed(2)}-${lows[i].toFixed(2)}`, index: i });
    }
    if (highs[i] < lows[i - 2]) {
      gaps.push({ direction: "BEARISH", zone: `${highs[i].toFixed(2)}-${lows[i - 2].toFixed(2)}`, index: i });
    }
  }
  return gaps.slice(-4);
}

function parsePriceZone(zone: string): { low: number; high: number } | null {
  const [a, b] = zone.split("-").map((v) => parseFloat(v));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { low: Math.min(a, b), high: Math.max(a, b) };
}

function evaluateSMCStatus(
  orderBlocks: Array<{ type: string; price_zone: string; strength: string; index: number }>,
  fvgs: Array<{ direction: string; zone: string; index: number }>,
  highs: number[],
  lows: number[],
) {
  const orderBlockStatus = orderBlocks.map((ob) => {
    const zone = parsePriceZone(ob.price_zone);
    if (!zone) {
      return { type: ob.type, price_zone: ob.price_zone, strength: ob.strength, status: "ACTIVE" as const };
    }

    let mitigated = false;
    for (let i = ob.index + 1; i < highs.length; i++) {
      const overlaps = lows[i] <= zone.high && highs[i] >= zone.low;
      if (overlaps) {
        mitigated = true;
        break;
      }
    }

    return {
      type: ob.type,
      price_zone: ob.price_zone,
      strength: ob.strength,
      status: mitigated ? "MITIGATED" : "ACTIVE",
    };
  });

  const fvgStatus = fvgs.map((fvg) => {
    const zone = parsePriceZone(fvg.zone);
    if (!zone) {
      return { direction: fvg.direction, zone: fvg.zone, status: "ACTIVE" as const };
    }

    let filled = false;
    for (let i = fvg.index + 1; i < highs.length; i++) {
      const fullFill = lows[i] <= zone.low && highs[i] >= zone.high;
      if (fullFill) {
        filled = true;
        break;
      }
    }

    return {
      direction: fvg.direction,
      zone: fvg.zone,
      status: filled ? "FILLED" : "ACTIVE",
    };
  });

  return {
    order_blocks: orderBlockStatus,
    fair_value_gaps: fvgStatus,
    summary: {
      active_order_blocks: orderBlockStatus.filter((x) => x.status === "ACTIVE").length,
      mitigated_order_blocks: orderBlockStatus.filter((x) => x.status === "MITIGATED").length,
      active_fvgs: fvgStatus.filter((x) => x.status === "ACTIVE").length,
      filled_fvgs: fvgStatus.filter((x) => x.status === "FILLED").length,
    },
  };
}

interface HarmonicPatternSignal {
  pattern: "GARTLEY" | "BAT" | "CRAB" | "BUTTERFLY" | "SHARK";
  direction: "BULLISH" | "BEARISH";
  completion_pct: number;
  confidence_pct: number;
  prz: string;
}

function ratioScore(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= min && value <= max) return 1;
  const center = (min + max) / 2;
  const tolerance = (max - min) / 2;
  if (tolerance === 0) return 0;
  const normalized = Math.abs(value - center) / tolerance;
  return Math.max(0, 1 - normalized);
}

function detectHarmonicPatterns(swingPoints: SwingPoint[], currentPrice: number, atr: number): HarmonicPatternSignal[] {
  if (swingPoints.length < 5) return [];

  const allResults: HarmonicPatternSignal[] = [];
  const templates = [
    { pattern: "GARTLEY", xab: [0.55, 0.70], abc: [0.38, 0.886], bcd: [1.13, 1.618], xad: [0.74, 0.82] },
    { pattern: "BAT", xab: [0.38, 0.52], abc: [0.38, 0.886], bcd: [1.618, 2.618], xad: [0.84, 0.91] },
    { pattern: "CRAB", xab: [0.38, 0.62], abc: [0.38, 0.886], bcd: [2.24, 3.618], xad: [1.52, 1.70] },
    { pattern: "BUTTERFLY", xab: [0.74, 0.82], abc: [0.38, 0.886], bcd: [1.618, 2.24], xad: [1.18, 1.35] },
    { pattern: "SHARK", xab: [0.84, 1.13], abc: [1.13, 1.618], bcd: [1.27, 2.24], xad: [0.95, 1.30] },
  ] as const;

  // Search multiple windows of swing points (5, 6, 7, 8 points)
  const maxWindow = Math.min(swingPoints.length, 8);
  for (let windowSize = 5; windowSize <= maxWindow; windowSize++) {
    const points = swingPoints.slice(-windowSize);
    // Try multiple XABCD combinations within the window
    for (let start = 0; start <= points.length - 5; start++) {
      const [x, a, b, c, d] = points.slice(start, start + 5);

      const xa = Math.abs(a.price - x.price);
      const ab = Math.abs(b.price - a.price);
      const bc = Math.abs(c.price - b.price);
      const cd = Math.abs(d.price - c.price);
      const ad = Math.abs(d.price - a.price);

      if (xa === 0 || ab === 0 || bc === 0) continue;

      const xab = ab / xa;
      const abc = bc / ab;
      const bcd = cd / bc;
      const xad = ad / xa;

      const direction: "BULLISH" | "BEARISH" = d.price < c.price ? "BULLISH" : "BEARISH";
      const range = Math.max(atr * 0.8, Math.abs(d.price - c.price) * 0.25, currentPrice * 0.003);
      const przLow = Math.min(d.price - range, d.price + range);
      const przHigh = Math.max(d.price - range, d.price + range);
      const completion = Math.max(0, Math.min(100, 100 - (Math.abs(currentPrice - d.price) / Math.max(atr * 3, currentPrice * 0.01)) * 100));

      for (const tpl of templates) {
        const score = (
          ratioScore(xab, tpl.xab[0], tpl.xab[1]) +
          ratioScore(abc, tpl.abc[0], tpl.abc[1]) +
          ratioScore(bcd, tpl.bcd[0], tpl.bcd[1]) +
          ratioScore(xad, tpl.xad[0], tpl.xad[1])
        ) / 4;

        const confidencePct = parseFloat((Math.max(35, score * 100)).toFixed(1));
        if (confidencePct >= 38) { // Lower threshold from 45 to 38
          // Check if this pattern type already found with higher confidence
          const existing = allResults.find(r => r.pattern === tpl.pattern);
          if (!existing || existing.confidence_pct < confidencePct) {
            if (existing) allResults.splice(allResults.indexOf(existing), 1);
            allResults.push({
              pattern: tpl.pattern,
              direction,
              completion_pct: parseFloat(completion.toFixed(1)),
              confidence_pct: confidencePct,
              prz: `${przLow.toFixed(2)}-${przHigh.toFixed(2)}`,
            } as HarmonicPatternSignal);
          }
        }
      }
    }
  }

  return allResults
    .sort((a, b) => b.confidence_pct - a.confidence_pct)
    .slice(0, 3);
}

function calcDualScenarios(
  entry: number,
  atr: number,
  bullProb: number,
  bearProb: number,
  primarySignal: string,
) {
  const riskUnit = Math.max(atr * 1.2, entry * 0.004);

  const buy = {
    probability_pct: parseFloat(Math.max(5, Math.min(95, bullProb)).toFixed(1)),
    entry: parseFloat(entry.toFixed(6)),
    stop_loss: parseFloat((entry - riskUnit).toFixed(6)),
    take_profit_1: parseFloat((entry + riskUnit).toFixed(6)),
    take_profit_2: parseFloat((entry + riskUnit * 2).toFixed(6)),
    take_profit_3: parseFloat((entry + riskUnit * 3).toFixed(6)),
  };

  const sell = {
    probability_pct: parseFloat(Math.max(5, Math.min(95, bearProb)).toFixed(1)),
    entry: parseFloat(entry.toFixed(6)),
    stop_loss: parseFloat((entry + riskUnit).toFixed(6)),
    take_profit_1: parseFloat((entry - riskUnit).toFixed(6)),
    take_profit_2: parseFloat((entry - riskUnit * 2).toFixed(6)),
    take_profit_3: parseFloat((entry - riskUnit * 3).toFixed(6)),
  };

  return {
    primary_signal: primarySignal,
    buy,
    sell,
  };
}

function calcExtendedMonteCarlo(closes: number[], timestamps: number[], horizonBars = 20) {
  if (closes.length < 30) return null;

  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }

  if (returns.length === 0) return null;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const std = Math.sqrt(variance);

  const drift = mean * horizonBars;
  const sigma = std * Math.sqrt(horizonBars);
  const lastPrice = closes[closes.length - 1];

  const optimistic = lastPrice * (1 + drift + 0.84 * sigma);
  const median = lastPrice * (1 + drift);
  const pessimistic = lastPrice * (1 + drift - 0.84 * sigma);

  const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const seasonalityMap = new Map<number, { total: number; wins: number; sum: number }>();

  for (let i = 1; i < closes.length; i++) {
    const ts = timestamps[i];
    if (!ts) continue;
    const month = new Date(ts).getUTCMonth();
    const ret = (closes[i] - closes[i - 1]) / closes[i - 1];

    const bucket = seasonalityMap.get(month) || { total: 0, wins: 0, sum: 0 };
    bucket.total += 1;
    bucket.sum += ret;
    if (ret > 0) bucket.wins += 1;
    seasonalityMap.set(month, bucket);
  }

  const seasonality = Array.from(seasonalityMap.entries())
    .map(([month, stats]) => ({
      month: monthLabels[month],
      avg_return_pct: parseFloat(((stats.sum / Math.max(1, stats.total)) * 100).toFixed(3)),
      win_rate_pct: parseFloat(((stats.wins / Math.max(1, stats.total)) * 100).toFixed(1)),
      samples: stats.total,
    }))
    .sort((a, b) => b.avg_return_pct - a.avg_return_pct)
    .slice(0, 6);

  return {
    optimistic_target: parseFloat(optimistic.toFixed(6)),
    median_target: parseFloat(median.toFixed(6)),
    pessimistic_target: parseFloat(pessimistic.toFixed(6)),
    horizon_bars: horizonBars,
    seasonality,
  };
}

function detectBOS(swingPoints: SwingPoint[], closes: number[]): string {
  if (swingPoints.length < 4) return "NONE";
  const lastPrice = closes[closes.length - 1];
  const recentHighs = swingPoints.filter(p => p.type === "high").slice(-3);
  const recentLows = swingPoints.filter(p => p.type === "low").slice(-3);
  if (recentHighs.length >= 2) {
    const lastSwingHigh = recentHighs[recentHighs.length - 1];
    if (lastPrice > lastSwingHigh.price) return "BULLISH_BOS";
  }
  if (recentLows.length >= 2) {
    const lastSwingLow = recentLows[recentLows.length - 1];
    if (lastPrice < lastSwingLow.price) return "BEARISH_BOS";
  }
  return "NONE";
}

function detectLiquidityZones(swingPoints: SwingPoint[]): Array<{ type: string; price: number }> {
  const zones: Array<{ type: string; price: number }> = [];
  const highs = swingPoints.filter(p => p.type === "high").slice(-3);
  const lows = swingPoints.filter(p => p.type === "low").slice(-3);
  highs.forEach(h => zones.push({ type: "BUY_SIDE", price: parseFloat(h.price.toFixed(2)) }));
  lows.forEach(l => zones.push({ type: "SELL_SIDE", price: parseFloat(l.price.toFixed(2)) }));
  return zones.slice(-4);
}

// Cross-asset correlation
async function fetchBTCDominance(): Promise<{ btcDominance: number; btcChange24h: number } | null> {
  try {
    const res = await fetchWithRetry("https://api.coingecko.com/api/v3/global");
    if (!res) return null;
    const data = await res.json();
    const btcDom = data?.data?.market_cap_percentage?.btc;
    const btcChange = data?.data?.market_cap_change_percentage_24h_usd;
    if (btcDom) {
      console.log(`[DATA] BTC Dominance: ${btcDom.toFixed(1)}%, Market 24h: ${btcChange?.toFixed(2)}%`);
      return { btcDominance: btcDom, btcChange24h: btcChange || 0 };
    }
    return null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[DATA] BTC Dominance error: ${msg}`);
    return null;
  }
}

async function fetchFearGreed(): Promise<{ value: number; classification: string } | null> {
  try {
    const res = await fetchWithRetry("https://api.alternative.me/fng/?limit=1");
    if (!res) return null;
    const data = await res.json();
    const fg = data?.data?.[0];
    if (fg) return { value: parseInt(fg.value), classification: fg.value_classification };
    return null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[DATA] Fear & Greed error: ${msg}`);
    return null;
  }
}

async function fetchFundingRate(symbol: string): Promise<number | null> {
  try {
    const res = await fetchWithRetry(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`);
    if (!res) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) return parseFloat(data[0].fundingRate);
    return null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[DATA] Funding Rate error: ${msg}`);
    return null;
  }
}

// ============================================================
// DATA SOURCES
// ============================================================

interface OHLCVData {
  timestamps: number[];
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
  source: string;
  hasRealVolume: boolean;
  assetType: "crypto" | "forex" | "b3" | "stock" | "unknown";
  spotPrice?: number;
  rawKlines?: (string | number)[][]; // Raw Binance klines for taker buy extraction
}

const COINGECKO_MAP: Record<string, string> = {
  "BTC/USDT": "bitcoin", "BTC/USD": "bitcoin", "BTC": "bitcoin", "BTCUSDT": "bitcoin",
  "ETH/USDT": "ethereum", "ETH/USD": "ethereum", "ETH": "ethereum", "ETHUSDT": "ethereum",
  "SOL/USDT": "solana", "SOL/USD": "solana", "SOL": "solana", "SOLUSDT": "solana",
  "ADA/USDT": "cardano", "ADA/USD": "cardano", "ADA": "cardano", "ADAUSDT": "cardano",
  "DOT/USDT": "polkadot", "DOT/USD": "polkadot", "DOT": "polkadot", "DOTUSDT": "polkadot",
  "AVAX/USDT": "avalanche-2", "AVAX/USD": "avalanche-2", "AVAX": "avalanche-2", "AVAXUSDT": "avalanche-2",
  "DOGE/USDT": "dogecoin", "DOGE/USD": "dogecoin", "DOGE": "dogecoin", "DOGEUSDT": "dogecoin",
  "XRP/USDT": "ripple", "XRP/USD": "ripple", "XRP": "ripple", "XRPUSDT": "ripple",
  "LINK/USDT": "chainlink", "LINK/USD": "chainlink", "LINK": "chainlink", "LINKUSDT": "chainlink",
  "MATIC/USDT": "matic-network", "MATIC/USD": "matic-network", "MATIC": "matic-network", "MATICUSDT": "matic-network",
  "BNB/USDT": "binancecoin", "BNB/USD": "binancecoin", "BNB": "binancecoin", "BNBUSDT": "binancecoin",
  "ATOM/USDT": "cosmos", "NEAR/USDT": "near", "ARB/USDT": "arbitrum",
  "OP/USDT": "optimism", "SUI/USDT": "sui", "APT/USDT": "aptos",
  "UNI/USDT": "uniswap", "AAVE/USDT": "aave", "LTC/USDT": "litecoin",
  "ATOMUSDT": "cosmos", "NEARUSDT": "near", "ARBUSDT": "arbitrum",
  "OPUSDT": "optimism", "SUIUSDT": "sui", "APTUSDT": "aptos",
  "UNIUSDT": "uniswap", "AAVEUSDT": "aave", "LTCUSDT": "litecoin",
  "XAU/USD": "pax-gold", "XAUUSD": "pax-gold", "XAU": "pax-gold", "GOLD": "pax-gold",
  "PAXGUSDT": "pax-gold", "PAXG/USDT": "pax-gold", "PAXG": "pax-gold"
};

const BINANCE_API_ENDPOINTS = [
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
  "https://api.binance.com",
  "https://data-api.binance.vision",
];

async function fetchWithRetry(url: string, maxRetries = 3, headers?: Record<string, string>): Promise<Response | null> {
  const urlPath = url.split('?')[0].split('/').slice(-2).join('/');
  
  // If it's a Binance URL, try multiple endpoints
  const isBinance = url.includes('api.binance.com') || url.includes('binance.vision');
  if (isBinance) {
    const urlObj = new URL(url);
    const pathAndQuery = urlObj.pathname + urlObj.search;
    
    for (const base of BINANCE_API_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(`${base}${pathAndQuery}`, {
          ...(headers ? { headers } : {}),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) return res;
        const errText = await res.text();
        if (errText.includes("restricted location")) {
          console.warn(`[FETCH] ${base} geo-blocked, trying next...`);
          continue;
        }
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        console.warn(`[FETCH] ${base}${urlObj.pathname} → ${res.status}: ${errText.substring(0, 150)}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[FETCH] ${base} failed: ${msg}`);
        continue;
      }
    }
    console.error(`[FETCH] All Binance endpoints failed for ${urlPath}`);
    return null;
  }

  // Non-Binance URLs: standard retry
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { 
        ...(headers ? { headers } : {}),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) return res;
      if (res.status === 429 && attempt < maxRetries) {
        const waitMs = (attempt + 1) * 3000;
        console.warn(`[FETCH] ${urlPath} rate-limited (429), retrying in ${waitMs}ms`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      const errText = await res.text();
      console.warn(`[FETCH] ${urlPath} returned ${res.status}: ${errText.substring(0, 200)}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      const errorName = (e as Record<string, unknown>)?.name;
      const isTimeout = errorName === 'AbortError';
      console.warn(`[FETCH] ${urlPath} ${isTimeout ? 'TIMEOUT' : 'ERROR'}: ${error.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
      }
    }
  }
  console.error(`[FETCH] ${urlPath} FAILED after ${maxRetries + 1} attempts`);
  return null;
}

const BINANCE_INTERVAL_MAP: Record<string, string> = {
  "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
  "1H": "1h", "4H": "4h", "1D": "1d", "1W": "1w",
  "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w",
  "5M": "5m", "15M": "15m", "30M": "30m",
};

const CANDLE_LIMIT_MAP: Record<string, number> = {
  "1m": 200, "5m": 200, "5M": 200, "15m": 200, "15M": 200, "30m": 200, "30M": 200,
  "1H": 200, "4H": 150, "1D": 120, "1W": 80,
  "1h": 200, "4h": 150, "1d": 120, "1w": 80,
};

const BINANCE_SYMBOL_MAP: Record<string, string> = {
  "BTC/USDT": "BTCUSDT", "BTC/USD": "BTCUSDT", "BTC": "BTCUSDT", "BTCUSDT": "BTCUSDT",
  "ETH/USDT": "ETHUSDT", "ETH/USD": "ETHUSDT", "ETH": "ETHUSDT", "ETHUSDT": "ETHUSDT",
  "SOL/USDT": "SOLUSDT", "SOL/USD": "SOLUSDT", "SOL": "SOLUSDT", "SOLUSDT": "SOLUSDT",
  "ADA/USDT": "ADAUSDT", "ADA/USD": "ADAUSDT", "ADA": "ADAUSDT", "ADAUSDT": "ADAUSDT",
  "DOT/USDT": "DOTUSDT", "DOT/USD": "DOTUSDT", "DOT": "DOTUSDT", "DOTUSDT": "DOTUSDT",
  "AVAX/USDT": "AVAXUSDT", "AVAX/USD": "AVAXUSDT", "AVAX": "AVAXUSDT", "AVAXUSDT": "AVAXUSDT",
  "DOGE/USDT": "DOGEUSDT", "DOGE/USD": "DOGEUSDT", "DOGE": "DOGEUSDT", "DOGEUSDT": "DOGEUSDT",
  "XRP/USDT": "XRPUSDT", "XRP/USD": "XRPUSDT", "XRP": "XRPUSDT", "XRPUSDT": "XRPUSDT",
  "LINK/USDT": "LINKUSDT", "LINK/USD": "LINKUSDT", "LINK": "LINKUSDT", "LINKUSDT": "LINKUSDT",
  "MATIC/USDT": "MATICUSDT", "MATIC/USD": "MATICUSDT", "MATIC": "MATICUSDT", "MATICUSDT": "MATICUSDT",
  "BNB/USDT": "BNBUSDT", "BNB/USD": "BNBUSDT", "BNB": "BNBUSDT", "BNBUSDT": "BNBUSDT",
  "ATOM/USDT": "ATOMUSDT", "NEAR/USDT": "NEARUSDT", "ARB/USDT": "ARBUSDT",
  "OP/USDT": "OPUSDT", "SUI/USDT": "SUIUSDT", "APT/USDT": "APTUSDT",
  "UNI/USDT": "UNIUSDT", "AAVE/USDT": "AAVEUSDT", "LTC/USDT": "LTCUSDT",
  "ATOMUSDT": "ATOMUSDT", "NEARUSDT": "NEARUSDT", "ARBUSDT": "ARBUSDT",
  "OPUSDT": "OPUSDT", "SUIUSDT": "SUIUSDT", "APTUSDT": "APTUSDT",
  "UNIUSDT": "UNIUSDT", "AAVEUSDT": "AAVEUSDT", "LTCUSDT": "LTCUSDT",
  "XAU/USD": "PAXGUSDT", "XAUUSD": "PAXGUSDT", "XAU": "PAXGUSDT", "GOLD": "PAXGUSDT",
  "PAXGUSDT": "PAXGUSDT", "PAXG/USDT": "PAXGUSDT", "PAXG": "PAXGUSDT"
};

// ============================================================
// MULTI-TIMEFRAME: Map current TF to higher TF
// ============================================================
const HTF_MAP: Record<string, string> = {
  "1m": "15m", "5m": "1h", "5M": "1h", "15m": "4h", "15M": "4h", "30m": "4h", "30M": "4h",
  "1H": "4h", "1h": "4h", "4H": "1d", "4h": "1d", "1D": "1w", "1d": "1w", "1W": "1w",
};

async function fetchBinanceKlines(symbol: string, interval: string, limit: number): Promise<OHLCVData | null> {
  try {
    console.log(`[BINANCE] Fetching klines: ${symbol} ${interval} limit=${limit}`);
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetchWithRetry(url, 3, { 'Cache-Control': 'no-cache' });
    if (!res) {
      console.error(`[BINANCE] FAILED to fetch klines for ${symbol} ${interval} — fetchWithRetry returned null`);
      return null;
    }
    const klines = await res.json();
    if (!Array.isArray(klines) || klines.length < 20) {
      console.error(`[BINANCE] Invalid klines response for ${symbol}: isArray=${Array.isArray(klines)}, length=${Array.isArray(klines) ? klines.length : 'N/A'}`);
      return null;
    }
    
    const timestamps = klines.map((k: (string | number)[]) => Number(k[0]));
    const opens = klines.map((k: (string | number)[]) => parseFloat(String(k[1])));
    const highs = klines.map((k: (string | number)[]) => parseFloat(String(k[2])));
    const lows = klines.map((k: (string | number)[]) => parseFloat(String(k[3])));
    const closes = klines.map((k: (string | number)[]) => parseFloat(String(k[4])));
    const volumes = klines.map((k: (string | number)[]) => parseFloat(String(k[5])));
    const hasRealVolume = volumes.some((v) => v > 0);
    
    console.log(`[BINANCE] ✅ Got ${klines.length} klines for ${symbol} ${interval} — last close: $${closes[closes.length - 1]}`);
    
    // Get spot price from last ticker
    let spotPrice: number | undefined;
    try {
      const tickerRes = await fetchWithRetry(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, 2);
      if (tickerRes) {
        const tickerData = await tickerRes.json();
        spotPrice = parseFloat(tickerData.price);
        console.log(`[BINANCE] Spot price for ${symbol}: $${spotPrice}`);
      }
    } catch (e) {
      console.warn(`[BINANCE] Spot price fetch failed for ${symbol}: ${e}`);
    }
    
    return { timestamps, opens, highs, lows, closes, volumes, source: `Binance (${interval} real-time klines)`, hasRealVolume, assetType: "crypto", spotPrice, rawKlines: klines };
  } catch (e) {
    console.error(`[BINANCE] Exception in fetchBinanceKlines(${symbol}, ${interval}): ${e}`);
    return null;
  }
}

async function fetchCryptoData(coinId: string, timeframe = "1H", assetKey = ""): Promise<OHLCVData | null> {
  const binanceSymbol = BINANCE_SYMBOL_MAP[assetKey.toUpperCase().trim()];
  const binanceInterval = BINANCE_INTERVAL_MAP[timeframe] || "1h";
  const limit = CANDLE_LIMIT_MAP[timeframe] || 200;

  if (binanceSymbol) {
    console.log(`[DATA] Binance klines: ${binanceSymbol} ${binanceInterval} limit=${limit}`);
    const data = await fetchBinanceKlines(binanceSymbol, binanceInterval, limit);
    if (data) {
      console.log(`[DATA] Binance: ${data.closes.length} real ${binanceInterval} candles for ${binanceSymbol} (volume: ${data.hasRealVolume ? "real" : "unavailable"})`);
      if (data.spotPrice) {
        console.log(`[DATA] Using SPOT price $${data.spotPrice} (last candle close was $${data.closes[data.closes.length - 1]}, diff: ${((data.spotPrice - data.closes[data.closes.length - 1]) / data.closes[data.closes.length - 1] * 100).toFixed(2)}%)`);
      }
      return data;
    }
  }
  return null;
}

async function fetchForexData(base: string, quote: string, days = 90): Promise<OHLCVData | null> {
  try {
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const url = `https://api.frankfurter.dev/${startDate}..${endDate}?from=${base}&to=${quote}`;
    const res = await fetchWithRetry(url);
    if (!res) return null;
    const data = await res.json();
    const rates = data?.rates;
    if (!rates || Object.keys(rates).length < 10) return null;
    const sortedDates = Object.keys(rates).sort();
    const timestamps = sortedDates.map(d => new Date(d).getTime());
    const closes = sortedDates.map(d => rates[d][quote]);
    const opens: number[] = [closes[0]];
    const highs: number[] = [];
    const lows: number[] = [];
    for (let i = 1; i < closes.length; i++) opens.push(closes[i - 1]);
    for (let i = 0; i < closes.length; i++) {
      const c = closes[i];
      const prevClose = i > 0 ? closes[i - 1] : c;
      const diff = Math.abs(c - prevClose);
      const intradayExtension = diff > 0 ? diff * 1.2 : c * 0.001;
      if (c >= prevClose) {
        highs.push(c + intradayExtension * 0.3);
        lows.push(prevClose - intradayExtension * 0.2);
      } else {
        highs.push(prevClose + intradayExtension * 0.2);
        lows.push(c - intradayExtension * 0.3);
      }
    }
    const volumes = closes.map(() => 0);
    console.log(`[DATA] Frankfurter: ${closes.length} real ${base}/${quote} daily rates`);
    return { timestamps, opens, highs, lows, closes, volumes, source: `Frankfurter/ECB (Real ${base}/${quote} rates)`, hasRealVolume: false, assetType: "forex" };
  } catch { return null; }
}

async function fetchB3Data(ticker: string, days = 30): Promise<OHLCVData | null> {
  try {
    const range = days <= 30 ? "1mo" : days <= 90 ? "3mo" : "6mo";
    const url = `https://brapi.dev/api/quote/${ticker}?range=${range}&interval=1d&fundamental=false`;
    const res = await fetchWithRetry(url);
    if (!res) return null;
    const data = await res.json();
    const history = data?.results?.[0]?.historicalDataPrice;
    if (!Array.isArray(history) || history.length < 10) return null;
    const timestamps = history.map((h: any) => h.date * 1000);
    const opens = history.map((h: any) => h.open);
    const highs = history.map((h: any) => h.high);
    const lows = history.map((h: any) => h.low);
    const closes = history.map((h: any) => h.close);
    const volumes = history.map((h: any) => h.volume || 0);
    const hasRealVolume = volumes.some((v: number) => v > 0);
    console.log(`[DATA] Brapi: ${history.length} candles for ${ticker}`);
    return { timestamps, opens, highs, lows, closes, volumes, source: `Brapi (B3 Real Data - ${ticker})`, hasRealVolume, assetType: "b3" };
  } catch { return null; }
}

const FOREX_PAIRS: Record<string, [string, string]> = {
  "EUR/USD": ["EUR", "USD"], "GBP/USD": ["GBP", "USD"], "USD/JPY": ["USD", "JPY"],
  "USD/CHF": ["USD", "CHF"], "AUD/USD": ["AUD", "USD"], "USD/CAD": ["USD", "CAD"],
  "NZD/USD": ["NZD", "USD"], "EUR/GBP": ["EUR", "GBP"], "EUR/JPY": ["EUR", "JPY"],
  "GBP/JPY": ["GBP", "JPY"], "EUR/CHF": ["EUR", "CHF"], "AUD/JPY": ["AUD", "JPY"],
};

const B3_STOCKS = [
  "PETR4", "VALE3", "ITUB4", "BBDC4", "ABEV3", "WEGE3", "RENT3", "BBAS3",
  "B3SA3", "SUZB3", "JBSS3", "MGLU3", "VBBR3", "PRIO3", "RADL3", "RAIL3",
  "HAPV3", "TOTS3", "ELET3", "CSAN3", "ITSA4", "VIVT3", "BEEF3", "CMIG4",
];

async function resolveAssetData(asset: string, timeframe = "1H"): Promise<OHLCVData | null> {
  const key = asset.toUpperCase().trim();
  const coinId = COINGECKO_MAP[key];
  if (coinId) {
    console.log(`[DATA] Resolving crypto: ${key} -> ${coinId} (timeframe: ${timeframe})`);
    return await fetchCryptoData(coinId, timeframe, key);
  }
  const forexPair = FOREX_PAIRS[key];
  if (forexPair) {
    console.log(`[DATA] Resolving forex: ${key}`);
    return await fetchForexData(forexPair[0], forexPair[1]);
  }
  const b3Ticker = B3_STOCKS.find(s => key.includes(s));
  if (b3Ticker) {
    console.log(`[DATA] Resolving B3: ${b3Ticker}`);
    return await fetchB3Data(b3Ticker);
  }
  console.log(`[DATA] Trying Brapi generic for: ${key}`);
  const brapiResult = await fetchB3Data(key);
  if (brapiResult) { brapiResult.assetType = "stock"; return brapiResult; }
  console.warn(`[DATA] No real data source for: ${key}`);
  return null;
}

// ============================================================
// HTF BIAS CALCULATOR — quick bias from higher timeframe
// ============================================================

function calcHTFBias(data: OHLCVData): "BUY" | "SELL" | "NEUTRAL" {
  const { closes, highs, lows } = data;
  if (closes.length < 26) return "NEUTRAL";
  
  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, Math.min(50, closes.length));
  const price = closes[closes.length - 1];
  const ema20Val = ema20[ema20.length - 1];
  const ema50Val = ema50[ema50.length - 1];
  const rsi = calcRSI(closes);
  const adxResult = calcADX(highs, lows, closes);
  
  // Structure: EMA alignment + price position
  const priceAboveEMAs = price > ema20Val && price > ema50Val;
  const priceBelowEMAs = price < ema20Val && price < ema50Val;
  const emasBullish = ema20Val > ema50Val;
  const emasBearish = ema20Val < ema50Val;
  
  // ADX direction
  const adxBullish = adxResult.plusDI > adxResult.minusDI;
  const adxBearish = adxResult.minusDI > adxResult.plusDI;
  
  let score = 0;
  if (priceAboveEMAs) score += 2;
  if (priceBelowEMAs) score -= 2;
  if (emasBullish) score += 1;
  if (emasBearish) score -= 1;
  if (adxBullish && adxResult.adx > 20) score += 1;
  if (adxBearish && adxResult.adx > 20) score -= 1;
  if (rsi > 55) score += 0.5;
  if (rsi < 45) score -= 0.5;
  
  console.log(`[HTF] Bias score: ${score} (EMA20=${ema20Val.toFixed(2)}, EMA50=${ema50Val.toFixed(2)}, RSI=${rsi.toFixed(1)}, ADX=${adxResult.adx.toFixed(1)}, +DI=${adxResult.plusDI.toFixed(1)}, -DI=${adxResult.minusDI.toFixed(1)})`);
  
  if (score >= 2) return "BUY";
  if (score <= -2) return "SELL";
  return "NEUTRAL";
}

// ============================================================
// MAIN HANDLER
// ============================================================

function buildFallbackAnalysisJson(params: {
  asset: string;
  timeframe: string;
  ci: any;
  dataSource: string;
  fallbackReason: string;
}) {
  const { asset, timeframe, ci, dataSource, fallbackReason } = params;

  const signal = ci?.signal || "NEUTRO";
  const confidence = Math.round(ci?.confluence?.confidence ?? 50);
  const strength = Math.round(ci?.confluence?.signalStrength ?? 0);
  const entry = Number(ci?.currentPrice ?? 0);
  const stopLoss = Number(ci?.slResult?.stopLoss ?? entry);
  const slDistance = Number((ci?.slDistance ?? Math.abs(entry - stopLoss)) || 0);

  let tp1 = entry;
  let tp2 = entry;
  let tp3 = entry;
  if (signal === "COMPRA") {
    tp1 = entry + slDistance;
    tp2 = entry + slDistance * 2;
    tp3 = entry + slDistance * 3;
  } else if (signal === "VENDA") {
    tp1 = entry - slDistance;
    tp2 = entry - slDistance * 2;
    tp3 = entry - slDistance * 3;
  }

  const trend = ci?.ema20 > ci?.ema50 && ci?.ema50 > ci?.ema200
    ? "ALTA"
    : ci?.ema20 < ci?.ema50 && ci?.ema50 < ci?.ema200
      ? "BAIXA"
      : "LATERAL";

  const fallbackMessages: Record<string, string> = {
    google_rate_limit: "Quota da Google AI excedida; narrativa gerada em modo resiliente determinístico.",
    google_auth: "Falha de autenticação da Google AI; narrativa gerada em modo resiliente determinístico.",
    google_error: "Serviço da Google AI indisponível; narrativa gerada em modo resiliente determinístico.",
    parse_error: "Resposta inválida da IA; narrativa gerada em modo resiliente determinístico.",
    request_exception: "Erro de comunicação com IA; narrativa gerada em modo resiliente determinístico.",
    unknown: "Fallback resiliente ativado para manter o Auto Teste em execução.",
  };

  const summary =
    `Sinal ${signal} confirmado por motor determinístico com confiança ${confidence}%. ` +
    `Análise preservada em modo resiliente para evitar interrupção do Auto Teste.`;

  return {
    header: {
      asset,
      timeframe,
      signal,
      signal_strength_pct: strength,
      final_confidence_pct: confidence,
      trend,
    },
    risk_management: {
      entry_price: entry,
      stop_loss: stopLoss,
      take_profit_1: tp1,
      take_profit_2: tp2,
      take_profit_3: tp3,
      risk_reward_ratio: "1:1.0",
      atr_value: Number(ci?.atr ?? 0),
      risk_pct: entry > 0 ? Number(((slDistance / entry) * 100).toFixed(2)) : 0,
    },
    technical_indicators: {
      rsi: { value: Number(ci?.rsi ?? 50), signal: "N/A" },
      macd: {
        value: Number(ci?.macd?.value ?? 0),
        signal_line: Number(ci?.macd?.signal ?? 0),
        histogram: Number(ci?.macd?.histogram ?? 0),
        signal: "N/A",
      },
      adx: { value: Number(ci?.adx ?? 0), trend_strength: "N/A" },
      ema_20: Number(ci?.ema20 ?? entry),
      ema_50: Number(ci?.ema50 ?? entry),
      ema_200: Number(ci?.ema200 ?? entry),
      bollinger: {
        upper: Number(ci?.bollinger?.upper ?? entry),
        middle: Number(ci?.bollinger?.middle ?? entry),
        lower: Number(ci?.bollinger?.lower ?? entry),
      },
      volume_profile: ci?.hasRealVolume ? "REAL" : "ESTIMADO",
      mfi: Number(ci?.mfi ?? 50),
      cci: Number(ci?.cci ?? 0),
      stochastic: {
        k: Number(ci?.stochastic?.k ?? 50),
        d: Number(ci?.stochastic?.d ?? 50),
      },
      buy_signals: Number(ci?.buySignals ?? 0),
      sell_signals: Number(ci?.sellSignals ?? 0),
      neutral_signals: Number(ci?.neutralSignals ?? 0),
    },
    smc_analysis: {
      bias: signal === "COMPRA" ? "BULLISH" : signal === "VENDA" ? "BEARISH" : "NEUTRAL",
      order_blocks: [],
      fair_value_gaps: [],
      break_of_structure: "N/A",
      liquidity_zones: [],
    },
    wegd_analysis: {
      wyckoff_phase: "N/A",
      elliott_wave: "N/A",
      gann_angle: "N/A",
      dow_theory: "N/A",
      confluence_score: `${confidence}%`,
    },
    quantitative: {
      monte_carlo_bull_pct: Number(ci?.monteCarlo?.bullPct ?? 50),
      monte_carlo_bear_pct: Number(ci?.monteCarlo?.bearPct ?? 50),
      sharpe_ratio: Number(ci?.quantMetrics?.sharpe ?? 0),
      max_drawdown_pct: Number(ci?.quantMetrics?.maxDrawdown ?? 0),
      var_95_pct: Number(ci?.quantMetrics?.var95 ?? 0),
      sortino_ratio: Number(ci?.quantMetrics?.sortino ?? 0),
      win_rate_historical: Number(ci?.quantMetrics?.winRate ?? 50),
    },
    sentiment: {
      news_score: Number(ci?.fearGreedData?.value ?? 50),
      social_score: Number(ci?.fearGreedData?.value ?? 50),
      overall: "NEUTRO",
      recent_headlines: ["Modo resiliente: síntese local ativada sem depender de quota externa."],
    },
    institutional_synthesis: {
      executive_summary: summary,
      warning: fallbackMessages[fallbackReason] || fallbackMessages.unknown,
      best_hours: ["08:00-11:00 UTC", "13:00-16:00 UTC"],
    },
    _ai_fallback: {
      enabled: true,
      reason: fallbackReason,
      source: dataSource,
      timestamp: new Date().toISOString(),
    },
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { asset, timeframe, liveContext } = await req.json();

    if (!asset) {
      return new Response(JSON.stringify({ error: "Asset is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // AI narrative generation is now on-demand only (via generate-ai-narrative edge function)
    // No GOOGLE_AI_API_KEY required for the main analysis flow

    // ========== LOAD CALIBRATED WEIGHTS (Auto-Refine) ==========
    let calibratedWeights: Map<string, number> | null = null;
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const sbUrl = Deno.env.get("SUPABASE_URL")!;
      const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sbClient = createClient(sbUrl, sbKey);
      const { data: weights } = await sbClient
        .from("refinement_weights")
        .select("indicator_name, calibrated_weight")
        .eq("asset", asset.toUpperCase().trim())
        .eq("timeframe", timeframe || "1H");
      if (weights && weights.length > 0) {
        calibratedWeights = new Map();
        weights.forEach((w: { indicator_name: string; calibrated_weight: number }) => calibratedWeights!.set(w.indicator_name, Number(w.calibrated_weight)));
        console.log(`[REFINE] Loaded ${weights.length} calibrated weights for ${asset}/${timeframe}`);
      }
    } catch (e) {
      console.warn("[REFINE] Could not load calibrated weights:", e);
    }

    // ========== STEP 1: Fetch REAL market data + HTF + cross-asset ==========
    console.log(`[ANALYZE] Starting: ${asset} (${timeframe})`);
    const isCrypto = !!COINGECKO_MAP[asset.toUpperCase().trim()];
    const binanceSymKey = BINANCE_SYMBOL_MAP[asset.toUpperCase().trim()];
    const htfTimeframe = HTF_MAP[timeframe] || null;
    const htfBinanceInterval = htfTimeframe ? (BINANCE_INTERVAL_MAP[htfTimeframe] || null) : null;
    
    // Fetch primary TF + HTF + macro data + OI in parallel
    const fetchPromises: Promise<unknown>[] = [
      resolveAssetData(asset, timeframe || "1H"),
      isCrypto ? fetchBTCDominance() : Promise.resolve(null),
      isCrypto ? fetchFearGreed() : Promise.resolve(null),
      isCrypto && binanceSymKey ? fetchFundingRate(binanceSymKey) : Promise.resolve(null),
    ];
    
    // HTF data fetch (only for crypto with Binance)
    if (htfBinanceInterval && binanceSymKey && htfTimeframe !== timeframe) {
      fetchPromises.push(fetchBinanceKlines(binanceSymKey, htfBinanceInterval, 100));
      console.log(`[MTF] Fetching HTF: ${htfBinanceInterval} for ${binanceSymKey}`);
    } else {
      fetchPromises.push(Promise.resolve(null));
    }
    
    // Open Interest (Futures)
    fetchPromises.push(isCrypto && binanceSymKey ? fetchOpenInterest(binanceSymKey) : Promise.resolve(null));

    const [marketDataRaw, globalDataRaw, fearGreedDataRaw, fundingRateDataRaw, htfDataRaw, openInterestDataRaw] = await Promise.all(fetchPromises);
    const marketData = marketDataRaw as any;
    const globalData = globalDataRaw as any;
    const fearGreedData = fearGreedDataRaw as any;
    const fundingRateData = fundingRateDataRaw as any;
    const htfData = htfDataRaw as any;
    const openInterestData = openInterestDataRaw as any;

    let realDataPayload = "";
    let calculatedIndicators: any = null;
    let dataSource = "simulated";
    let smcData: any = null;
    let advancedData: any = null;
    let deterministicSignal: ConfluenceResult | null = null;

    const dataWarnings: string[] = [];

    // ========== HTF BIAS ==========
    let htfBias: "BUY" | "SELL" | "NEUTRAL" | null = null;
    if (htfData && htfData.closes && htfData.closes.length >= 26) {
      htfBias = calcHTFBias(htfData);
      console.log(`[MTF] HTF Bias (${htfBinanceInterval}): ${htfBias}`);
    } else {
      console.log(`[MTF] No HTF data available, proceeding without MTF filter`);
    }

    if (marketData && marketData.closes.length >= 26) {
      dataSource = marketData.source;
      const { opens, highs, lows, closes, volumes, hasRealVolume, assetType, spotPrice } = marketData;
      const currentPrice = spotPrice && spotPrice > 0 ? spotPrice : closes[closes.length - 1];
      const lastCandleClose = closes[closes.length - 1];

      // ===== CORE TA (Wilder's) =====
      const rsi = calcRSI(closes);
      const macd = calcMACD(closes);
      const atr = calcATR(highs, lows, closes);
      const adxResult = calcADX(highs, lows, closes);
      const adx = adxResult.adx;
      const plusDI = adxResult.plusDI;
      const minusDI = adxResult.minusDI;
      const bollinger = calcBollinger(closes);
      const stoch = calcStochastic(highs, lows, closes);
      const mfi = calcMFI(highs, lows, closes, volumes);
      const cci = calcCCI(highs, lows, closes);
      const ema20 = calcEMA(closes, 20);
      const ema50 = calcEMA(closes, Math.min(50, closes.length));
      const ema200 = calcEMA(closes, Math.min(200, closes.length));
      const monteCarlo = monteCarloSimulation(closes);
      const quantMetrics = calcQuantMetrics(closes);

      // ===== ADVANCED TA =====
      const vwap = calcVWAP(highs, lows, closes, volumes);
      const ichimoku = calcIchimoku(highs, lows, closes);
      const obv = hasRealVolume ? calcOBV(closes, volumes) : 0;
      const adLine = hasRealVolume ? calcADLine(highs, lows, closes, volumes) : 0;
      const lastH = highs[highs.length - 1], lastL = lows[lows.length - 1], lastC = closes[closes.length - 1];
      const pivots = calcPivotPoints(lastH, lastL, lastC);
      const candlePatterns = detectCandlePatterns(opens, closes, highs, lows);
      const rsiSeries = calcRSISeries(closes);
      const macdSeries = calcEMA(closes, 12).map((v, i) => v - calcEMA(closes, 26)[i]);
      const rsiDivergences = detectDivergences(closes, rsiSeries, "RSI");
      const macdDivergences = detectDivergences(closes, macdSeries, "MACD");
      const divergences = [...rsiDivergences, ...macdDivergences];
      const regime = detectRegime(adx, bollinger.upper, bollinger.lower, bollinger.middle);

      // ===== SMC =====
      const swingPoints = detectSwingPoints(highs, lows);
      const orderBlocks = detectOrderBlocks(opens, closes, highs, lows);
      const fvgs = detectFVGs(highs, lows);
      const bos = detectBOS(swingPoints, closes);
      const liquidityZones = detectLiquidityZones(swingPoints);
      const smcStatus = evaluateSMCStatus(orderBlocks, fvgs, highs, lows);
      const harmonicPatterns = detectHarmonicPatterns(swingPoints, currentPrice, atr);
      const monteCarloExtended = calcExtendedMonteCarlo(closes, marketData.timestamps, 20);
      smcData = { orderBlocks, fvgs, bos, liquidityZones, status: smcStatus };

      // ===== ADDITIONAL FEATURES =====
      const fibonacci = calcFibonacci(swingPoints, currentPrice);
      const marketSession = detectMarketSession();
      const liquidationLevels = isCrypto ? estimateLiquidationLevels(currentPrice, atr, "COMPRA") : null;
      const volumeDelta = hasRealVolume ? calcVolumeDelta(opens, closes, volumes) : null;
      const analysisTs = new Date().toISOString();

      // ===== NEW: MOMENTUM SLOPE SIGNALS =====
      const rsiMomentum = calcRSIMomentum(rsiSeries);
      const obvSlope = hasRealVolume ? calcOBVSlope(closes, volumes) : null;
      const emaCrossover = detectEMACrossover(ema20, ema50, 5);
      const macdSlope = macd.histogramSlope;
      const macdAccel = macd.histogramAccel;
      
      console.log(`[MOMENTUM] RSI slope=${rsiMomentum.slope} (${rsiMomentum.direction}), MACD hist slope=${macdSlope.toFixed(6)}, MACD accel=${macdAccel.toFixed(6)}, OBV=${obvSlope?.obvTrend || "N/A"}, EMA cross=${emaCrossover.type}`);

      // ===== NEW: REAL TAKER VOLUME =====
      const takerData = marketData.rawKlines ? calcRealTakerVolume(marketData.rawKlines) : null;
      if (takerData) {
        console.log(`[TAKER] Real taker buy ratio: ${(takerData.takerBuyRatio * 100).toFixed(1)}% — ${takerData.pressure}`);
      }

      // ===== NEW: ATR PERCENTILE =====
      const atrPercentile = calcATRPercentile(highs, lows, closes);
      console.log(`[VOL] ATR Percentile: ${atrPercentile.percentile}% — ${atrPercentile.classification}`);

      // ===== NEW: SERIES FOR REGIME-FILTERED CALCULATIONS =====
      const adxSeries = calcADXSeries(highs, lows, closes);
      const bbBWSeries = calcBBBandwidthSeries(closes);

      // ===== WEIGHTED CONFLUENCE — DYNAMIC ZONES =====
      const isTrending = regime.regime === "TRENDING";
      const trendMult = isTrending ? 1.3 : 0.7;
      const rangeMult = isTrending ? 0.7 : 1.3;
      const volMult = hasRealVolume ? 1.0 : 0.3;

      // ===== TIMEFRAME-DEPENDENT TIER SCALING =====
      // On short timeframes (<=15m), momentum (T2) matters MORE than structure (T1)
      // Reference platforms prioritize price action momentum on intraday charts
      const shortTfList = ["1m", "3m", "5m", "15m", "1M", "3M", "5M", "15M"];
      const isShortTF = shortTfList.includes(timeframe);
      const t1Scale = isShortTF ? 0.4 : 1.0;  // Structure weight further reduced on short TFs (was 0.6)
      const t2Scale = isShortTF ? 1.5 : 1.0;  // Momentum weight boosted on short TFs (was 1.4)

      // Progressive neutral zones: shorter MAs = tighter, longer MAs = wider (Fix bias)
      const emaDirWithPeriod = (price: number, emaVal: number, period: number): "BUY" | "SELL" | "NEUTRAL" => {
        let neutralPct: number;
        if (period <= 20) neutralPct = 0.003;       // 0.3%
        else if (period <= 50) neutralPct = 0.005;   // 0.5%
        else if (period <= 100) neutralPct = 0.008;  // 0.8%
        else neutralPct = 0.010;                     // 1.0% for 200+
        const pctDiff = (price - emaVal) / emaVal;
        if (pctDiff > neutralPct) return "BUY";
        if (pctDiff < -neutralPct) return "SELL";
        return "NEUTRAL";
      };
      // Legacy wrapper for non-MA uses (Ichimoku, VWAP, etc.)
      const emaDir = (price: number, emaVal: number): "BUY" | "SELL" | "NEUTRAL" => emaDirWithPeriod(price, emaVal, 20);

      const ema20Val = ema20[ema20.length - 1];
      const ema50Val = ema50[ema50.length - 1];
      const ema200Val = ema200[ema200.length - 1];
      const bullishAlignment = ema20Val > ema50Val && ema50Val > ema200Val;
      const bearishAlignment = ema20Val < ema50Val && ema50Val < ema200Val;

      // ===== ADDITIONAL MA CALCULATIONS (match reference platform) =====
      const sma10 = calcSMA(closes, 10);
      const sma20 = calcSMA(closes, 20);
      const sma50 = calcSMA(closes, 50);
      const sma100 = calcSMA(closes, Math.min(100, closes.length));
      const sma200 = calcSMA(closes, Math.min(200, closes.length));
      const ema10 = calcEMA(closes, 10)[closes.length - 1];
      const ema100 = calcEMA(closes, Math.min(100, closes.length))[Math.min(100, closes.length) - 1 < closes.length ? closes.length - 1 : Math.min(100, closes.length) - 1];

      // ===== ADDITIONAL OSCILLATORS (match reference platform) =====
      const williamsR = calcWilliamsR(highs, lows, closes);
      const awesomeOsc = calcAwesomeOscillator(highs, lows);
      const momentum10 = calcMomentum(closes, 10);
      const stochRSI = calcStochRSI(closes);
      const bullBearPower = calcBullBearPower(highs, lows, closes);
      const ultimateOsc = calcUltimateOscillator(highs, lows, closes);

      console.log(`[INDICATORS] SMA10=${sma10.toFixed(2)}, SMA20=${sma20.toFixed(2)}, SMA50=${sma50.toFixed(2)}, SMA100=${sma100.toFixed(2)}, EMA10=${ema10.toFixed(2)}, EMA100=${ema100.toFixed(2)}`);
      console.log(`[OSCILLATORS] WilliamsR=${williamsR.toFixed(2)}, AO=${awesomeOsc.toFixed(2)}, Mom=${momentum10.toFixed(2)}, StochRSI K=${stochRSI.k}, UO=${ultimateOsc.toFixed(2)}`);

      // DYNAMIC oscillator zones based on regime (Fix 3: all oscillators)
      const rsiOBLevel = isTrending ? 60 : 70;
      const rsiOSLevel = isTrending ? 40 : 30;
      const stochOBLevel = isTrending ? 70 : 80;
      const stochOSLevel = isTrending ? 30 : 20;
      const wrOBLevel = isTrending ? -30 : -20;
      const wrOSLevel = isTrending ? -70 : -80;
      const stochRsiOB = isTrending ? 70 : 80;
      const stochRsiOS = isTrending ? 30 : 20;
      const uoOB = isTrending ? 60 : 70;
      const uoOS = isTrending ? 40 : 30;
      const cciOB = isTrending ? 80 : 100;
      const cciOS = isTrending ? -80 : -100;

      // ===== MACD FADING MOMENTUM DETECTION =====
      const macdFading = macd.histogram > 0 && macdSlope < 0;
      const macdRecovering = macd.histogram < 0 && macdSlope > 0;
      const macdHistDir: "BUY" | "SELL" | "NEUTRAL" = macdFading ? "SELL" : macdRecovering ? "BUY" : (macd.histogram > 0 ? "BUY" : macd.histogram < 0 ? "SELL" : "NEUTRAL");

      // ===== MACD LINE vs SIGNAL LINE (separate from histogram) =====
      const macdLineDir: "BUY" | "SELL" | "NEUTRAL" = macd.value > macd.signal ? "BUY" : macd.value < macd.signal ? "SELL" : "NEUTRAL";

      // ===== RSI MID-ZONE + SLOPE COMPOSITE =====
      const rsiLevel = rsi;
      const rsiSlopeVal = rsiMomentum.slope;
      let rsiCompositeDir: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
      if (rsiLevel > 70) rsiCompositeDir = "SELL";
      else if (rsiLevel < 30) rsiCompositeDir = "BUY";
      else if (rsiLevel > 50 && rsiSlopeVal < -1) rsiCompositeDir = "SELL";
      else if (rsiLevel < 50 && rsiSlopeVal > 1) rsiCompositeDir = "BUY";
      else if (rsiLevel > rsiOBLevel) rsiCompositeDir = "SELL";
      else if (rsiLevel < rsiOSLevel) rsiCompositeDir = "BUY";

      // ===== MA weight: each MA is an individual signal (matches reference) =====
      // Reference counts ~14 MAs individually → each one votes independently
      const maWeight = isShortTF ? 0.7 : 0.6;  // Reduced from 1.0-1.2 to fix directional bias
      const oscWeight = isShortTF ? 1.3 : 1.0;  // Oscillators slightly boosted on short TFs

      const weightedSignals: WeightedSignal[] = [
        // TIER 1: STRUCTURE — scaled by timeframe (heavily reduced on short TFs)
        { name: "ICHIMOKU", direction: ichimoku.signal === "BULLISH" ? "BUY" : ichimoku.signal === "BEARISH" ? "SELL" : "NEUTRAL", weight: 2.0 * trendMult * t1Scale, tier: 1 },
        { name: "EMA200", direction: emaDir(currentPrice, ema200Val), weight: 1.5 * trendMult * t1Scale, tier: 1 },  // Reduced from 2.5
        { name: "BOS", direction: bos === "BULLISH_BOS" ? "BUY" : bos === "BEARISH_BOS" ? "SELL" : "NEUTRAL", weight: 2.0 * trendMult * t1Scale, tier: 1 },
        { name: "EMA_ALIGNMENT", direction: bullishAlignment ? "BUY" : bearishAlignment ? "SELL" : "NEUTRAL", weight: 1.5 * trendMult * t1Scale, tier: 1 },  // Reduced from 2.5

        // TIER 2: MOMENTUM — boosted on short TFs
        { name: "MACD_HIST", direction: macdHistDir, weight: 2.0 * trendMult * t2Scale, tier: 2 },
        { name: "MACD_LINE", direction: macdLineDir, weight: 2.0 * t2Scale, tier: 2 },  // NEW: MACD line vs signal line
        { name: "MACD_SLOPE", direction: macdSlope > 0 ? "BUY" : macdSlope < 0 ? "SELL" : "NEUTRAL", weight: 1.5 * trendMult * t2Scale, tier: 2 },
        { name: "MACD_ACCEL", direction: macdAccel > 0 ? "BUY" : macdAccel < 0 ? "SELL" : "NEUTRAL", weight: 1.0 * t2Scale, tier: 2 },
        { name: "ADX_DIR", direction: adx > 20 ? (plusDI > minusDI ? "BUY" : "SELL") : "NEUTRAL", weight: 2.0 * trendMult * t2Scale, tier: 2 },
        { name: "RSI_SLOPE", direction: rsiMomentum.direction === "ACCELERATING" ? "BUY" : rsiMomentum.direction === "DECELERATING" ? "SELL" : "NEUTRAL", weight: 1.5 * rangeMult * t2Scale, tier: 2 },

        // TIER 2b: INDIVIDUAL MOVING AVERAGES (match reference platform ~14 MAs)
        { name: "SMA10", direction: emaDirWithPeriod(currentPrice, sma10, 10), weight: maWeight, tier: 2 },
        { name: "SMA20", direction: emaDirWithPeriod(currentPrice, sma20, 20), weight: maWeight, tier: 2 },
        { name: "SMA50", direction: emaDirWithPeriod(currentPrice, sma50, 50), weight: maWeight, tier: 2 },
        { name: "SMA100", direction: emaDirWithPeriod(currentPrice, sma100, 100), weight: maWeight, tier: 2 },
        { name: "SMA200", direction: emaDirWithPeriod(currentPrice, sma200, 200), weight: maWeight, tier: 2 },
        { name: "EMA10", direction: emaDirWithPeriod(currentPrice, ema10, 10), weight: maWeight, tier: 2 },
        { name: "EMA20", direction: emaDirWithPeriod(currentPrice, ema20Val, 20), weight: maWeight, tier: 2 },
        { name: "EMA50", direction: emaDirWithPeriod(currentPrice, ema50Val, 50), weight: maWeight, tier: 2 },
        { name: "EMA100", direction: emaDirWithPeriod(currentPrice, ema100, 100), weight: maWeight, tier: 2 },

        // TIER 3: VOLUME
        { name: "VWAP", direction: currentPrice > vwap * 1.001 ? "BUY" : currentPrice < vwap * 0.999 ? "SELL" : "NEUTRAL", weight: 2.0 * volMult, tier: 3 },
        { name: "OBV_SLOPE", direction: obvSlope ? (obvSlope.obvTrend === "ACCUMULATION" ? "BUY" : obvSlope.obvTrend === "DISTRIBUTION" ? "SELL" : "NEUTRAL") : "NEUTRAL", weight: 2.0 * volMult, tier: 3 },
        { name: "MFI", direction: hasRealVolume ? (mfi < 20 ? "BUY" : mfi > 80 ? "SELL" : "NEUTRAL") : "NEUTRAL", weight: 1.0 * volMult, tier: 3 },

        // TIER 4: OSCILLATORS (dynamic zones per regime — Fix 3)
        { name: "RSI", direction: rsiCompositeDir, weight: 1.5 * rangeMult * oscWeight, tier: 4 },
        { name: "STOCH", direction: stoch.k < stochOSLevel ? "BUY" : stoch.k > stochOBLevel ? "SELL" : "NEUTRAL", weight: 1.0 * rangeMult * oscWeight, tier: 4 },
        { name: "BOLL", direction: currentPrice < bollinger.lower ? "BUY" : currentPrice > bollinger.upper ? "SELL" : "NEUTRAL", weight: 1.0 * rangeMult, tier: 4 },
        { name: "CCI", direction: cci < cciOS ? "BUY" : cci > cciOB ? "SELL" : "NEUTRAL", weight: 1.0 * rangeMult * oscWeight, tier: 4 },
        // OSCILLATORS with regime-dynamic zones:
        { name: "WILLIAMS_R", direction: williamsR < wrOSLevel ? "BUY" : williamsR > wrOBLevel ? "SELL" : "NEUTRAL", weight: 1.0 * oscWeight, tier: 4 },
        { name: "AO", direction: awesomeOsc > 0 ? "BUY" : awesomeOsc < 0 ? "SELL" : "NEUTRAL", weight: 1.0 * oscWeight, tier: 4 },
        { name: "MOMENTUM", direction: momentum10 > 0 ? "BUY" : momentum10 < 0 ? "SELL" : "NEUTRAL", weight: 1.0 * oscWeight, tier: 4 },
        { name: "STOCH_RSI", direction: stochRSI.k < stochRsiOS ? "BUY" : stochRSI.k > stochRsiOB ? "SELL" : "NEUTRAL", weight: 1.0 * oscWeight, tier: 4 },
        { name: "BULL_BEAR", direction: (bullBearPower.bull + bullBearPower.bear) > 0 ? "BUY" : "SELL", weight: 1.0 * oscWeight, tier: 4 },
        { name: "ULT_OSC", direction: ultimateOsc < uoOS ? "BUY" : ultimateOsc > uoOB ? "SELL" : "NEUTRAL", weight: 1.0 * oscWeight, tier: 4 },
      ];

      if (volumeDelta) {
        weightedSignals.push({ name: "VOL_DELTA", direction: volumeDelta.pressure === "COMPRADORES" ? "BUY" : volumeDelta.pressure === "VENDEDORES" ? "SELL" : "NEUTRAL", weight: 1.5 * volMult, tier: 3 });
      }
      const recentPatterns = candlePatterns.filter(p => p.index >= closes.length - 3);
      recentPatterns.forEach(p => {
        const isMultiCandle = ["BULLISH_ENGULFING", "BEARISH_ENGULFING", "MORNING_STAR", "EVENING_STAR"].includes(p.name);
        weightedSignals.push({ name: p.name, direction: p.type === "BULLISH" ? "BUY" : "SELL", weight: isMultiCandle ? 2.0 : 1.0, tier: 5 });
      });
      divergences.forEach(d => {
        weightedSignals.push({ name: `DIV_${d.indicator}`, direction: d.type === "BULLISH" ? "BUY" : "SELL", weight: 2.5, tier: 5 });
      });
      if (fibonacci) {
        const fibDist = Math.abs(currentPrice - fibonacci.nearestPrice) / currentPrice;
        if (fibDist < 0.005) {
          const fibDir = fibonacci.isUptrend ? (currentPrice > fibonacci.nearestPrice ? "BUY" : "SELL") : (currentPrice < fibonacci.nearestPrice ? "SELL" : "BUY");
          weightedSignals.push({ name: "FIB_PROXIMITY", direction: fibDir as "BUY" | "SELL", weight: 1.5, tier: 5 });
        }
      }
      // NEW: EMA Crossover (Golden/Death Cross)
      if (emaCrossover.crossed) {
        weightedSignals.push({ name: "EMA_CROSSOVER", direction: emaCrossover.type === "GOLDEN_CROSS" ? "BUY" : "SELL", weight: 2.5 * trendMult, tier: 1 });
      }
      // NEW: Real Taker Buy Volume
      if (takerData) {
        weightedSignals.push({ name: "TAKER_BUY", direction: takerData.pressure === "COMPRADORES_AGRESSIVOS" ? "BUY" : takerData.pressure === "VENDEDORES_AGRESSIVOS" ? "SELL" : "NEUTRAL", weight: 2.0 * volMult, tier: 3 });
      }
      // NEW: Open Interest
      if (openInterestData && openInterestData.oiChange !== 0) {
        // OI rising + price rising = bullish (new longs). OI rising + price falling = bearish (new shorts)
        const priceRising = currentPrice > closes[Math.max(0, closes.length - 5)];
        const oiDir = openInterestData.oiChange > 1 ? (priceRising ? "BUY" : "SELL") : openInterestData.oiChange < -1 ? (priceRising ? "SELL" : "BUY") : "NEUTRAL";
        weightedSignals.push({ name: "OPEN_INTEREST", direction: oiDir as "BUY" | "SELL" | "NEUTRAL", weight: 1.5, tier: 6 });
      }

      if (fearGreedData) {
        weightedSignals.push({ name: "FEAR_GREED", direction: fearGreedData.value < 25 ? "BUY" : fearGreedData.value > 75 ? "SELL" : "NEUTRAL", weight: 1.5, tier: 6 });
      }
      if (fundingRateData !== null) {
        weightedSignals.push({ name: "FUNDING_RATE", direction: fundingRateData > 0.0005 ? "SELL" : fundingRateData < -0.0005 ? "BUY" : "NEUTRAL", weight: 1.0, tier: 6 });
      }
      // NEW: Regime-filtered Monte Carlo
      const regimeMC = regimeFilteredMonteCarlo(closes, adxSeries, bbBWSeries, regime.regime);
      if (regimeMC.bullPct > 60) {
        weightedSignals.push({ name: "MC_REGIME", direction: "BUY", weight: 1.5, tier: 6 });
      } else if (regimeMC.bearPct > 60) {
        weightedSignals.push({ name: "MC_REGIME", direction: "SELL", weight: 1.5, tier: 6 });
      } else {
        weightedSignals.push({ name: "MC_REGIME", direction: "NEUTRAL", weight: 1.5, tier: 6 });
      }

      // ===== APPLY CALIBRATED WEIGHTS (Auto-Refine) =====
      if (calibratedWeights && calibratedWeights.size > 0) {
        let adjustedCount = 0;
        weightedSignals.forEach(s => {
          const calibrated = calibratedWeights!.get(s.name);
          if (calibrated !== undefined && calibrated !== s.weight) {
            s.weight = calibrated;
            adjustedCount++;
          }
        });
        if (adjustedCount > 0) {
          console.log(`[REFINE] Applied ${adjustedCount} calibrated weights`);
        }
      }

      // ===== DETERMINISTIC SIGNAL =====
      deterministicSignal = calcDeterministicSignal(weightedSignals, htfBias);
      const signal = deterministicSignal.signal;
      
      console.log(`[SIGNAL] DETERMINISTIC: ${signal} (confidence: ${deterministicSignal.confidence}%, strength: ${deterministicSignal.signalStrength}%, T1: ${deterministicSignal.tier1Direction}, T2: ${deterministicSignal.tier2Direction}, HTF: ${htfBias || "N/A"}, HTF agree: ${deterministicSignal.htfAgreement})`);

      // === BIAS AUDIT LOG (Fix 5) ===
      const buySignalsArr = weightedSignals.filter(s => s.direction === "BUY");
      const sellSignalsArr = weightedSignals.filter(s => s.direction === "SELL");
      const neutralSignalsArr = weightedSignals.filter(s => s.direction === "NEUTRAL");
      console.log(`[BIAS_AUDIT] Total: ${weightedSignals.length} signals | BUY: ${buySignalsArr.length} (${deterministicSignal.totalBuy.toFixed(1)}w) | SELL: ${sellSignalsArr.length} (${deterministicSignal.totalSell.toFixed(1)}w) | NEUTRAL: ${neutralSignalsArr.length} (${deterministicSignal.totalNeutral.toFixed(1)}w)`);
      for (const tierNum of [1, 2, 3, 4, 5, 6]) {
        const tierSigs = weightedSignals.filter(s => s.tier === tierNum);
        if (tierSigs.length === 0) continue;
        const tb = tierSigs.filter(s => s.direction === "BUY").length;
        const ts = tierSigs.filter(s => s.direction === "SELL").length;
        const tn = tierSigs.filter(s => s.direction === "NEUTRAL").length;
        console.log(`[BIAS_AUDIT] Tier${tierNum}: BUY=${tb} SELL=${ts} NEUTRAL=${tn}`);
      }

      // ===== STRUCTURAL STOP LOSS =====
      const slResult = calcStructuralSL(signal, currentPrice, atr, swingPoints, orderBlocks);
      const slDistance = Math.abs(currentPrice - slResult.stopLoss);
      console.log(`[SL] Structural SL: ${slResult.stopLoss} (method: ${slResult.method}, distance: ${slDistance.toFixed(2)})`);

      // ===== ATR Trailing =====
      const atrTrailing = calcATRTrailingStop(closes, highs, lows, signal === "COMPRA" ? "COMPRA" : "VENDA", atr);

      // ===== REGIME-FILTERED BACKTEST =====
      const backtest = regimeFilteredBacktest(opens, closes, highs, lows, signal === "COMPRA" ? "COMPRA" : "VENDA", slDistance, regime.regime, adxSeries, bbBWSeries, 10);
      const kelly = calcKellyCriterion(backtest.winRate, backtest.avgRR);
      console.log(`[BACKTEST] Regime-filtered (${regime.regime}): ${backtest.total} trades, WR=${backtest.winRate}%, TP1=${backtest.tp1Hits}, TP2=${backtest.tp2Hits}, TP3=${backtest.tp3Hits}`);

      // ===== BAYESIAN CONFIDENCE =====
      const bayesian = calcBayesianConfidence(deterministicSignal.confidence, htfBias, signal, backtest.winRate);
      // Use Bayesian posterior as the final confidence
      deterministicSignal.confidence = bayesian.posterior;
      console.log(`[BAYESIAN] Prior=${bayesian.prior}%, Likelihood=${bayesian.likelihood}%, Posterior=${bayesian.posterior}%`);

      // ===== RISK OF RUIN =====
      const riskPct = slDistance / currentPrice * 100;
      const riskOfRuin = calcRiskOfRuin(backtest.winRate, riskPct, backtest.avgRR);
      console.log(`[RISK] Risk of Ruin: ${riskOfRuin.riskOfRuin}% — ${riskOfRuin.classification}`);

      // ===== SCALE-OUT STRATEGY =====
      const scaleOut = calcScaleOutStrategy(slDistance, currentPrice, signal);
      // Use CONFLUENCE-based probabilities for dual scenarios (not raw Monte Carlo)
      const confluenceBuyPct = deterministicSignal.maxWeight > 0 
        ? (deterministicSignal.totalBuy / deterministicSignal.maxWeight) * 100 : 50;
      const confluenceSellPct = deterministicSignal.maxWeight > 0 
        ? (deterministicSignal.totalSell / deterministicSignal.maxWeight) * 100 : 50;
      const dualScenarios = calcDualScenarios(currentPrice, atr, confluenceBuyPct, confluenceSellPct, signal);

      // Backtest penalty: SOFT cap instead of multiplying down
      // Only apply if winRate is very low AND enough samples
      if (backtest.winRate < 35 && backtest.total >= 20) {
        const penalty = Math.max(0.90, backtest.winRate / 35); // Max 10% penalty
        deterministicSignal.confidence = parseFloat((deterministicSignal.confidence * penalty).toFixed(1));
        console.log(`[SIGNAL] Backtest soft penalty: WR ${backtest.winRate}% < 35%. Confidence adjusted to ${deterministicSignal.confidence}%`);
      }

      const buySignals = weightedSignals.filter(s => s.direction === "BUY").length;
      const sellSignals = weightedSignals.filter(s => s.direction === "SELL").length;
      const neutralSignals = weightedSignals.filter(s => s.direction === "NEUTRAL").length;

      advancedData = {
        vwap, ichimoku, obv, adLine, pivots, candlePatterns, divergences, regime,
        confluence: deterministicSignal, globalData,
        fibonacci, atrTrailing, marketSession, liquidationLevels, volumeDelta,
        fearGreedData, fundingRateData, backtest, kelly, analysisTs,
        smcStatus, harmonicPatterns, dualScenarios, monteCarloExtended,
      };

      calculatedIndicators = {
        currentPrice, rsi, macd, atr, adx, plusDI, minusDI, bollinger, stochastic: stoch,
        mfi, cci,
        ema20: ema20Val, ema50: ema50Val, ema200: ema200Val,
        monteCarlo, quantMetrics,
        buySignals, sellSignals, neutralSignals,
        hasRealVolume,
        vwap, ichimoku, obv, adLine, pivots, candlePatterns, divergences, regime,
        confluence: deterministicSignal,
        globalData,
        fibonacci, atrTrailing, marketSession, liquidationLevels, volumeDelta,
        fearGreedData, fundingRateData, backtest, kelly, analysisTs,
        slResult, slDistance,
        signal, htfBias,
        smcStatus, harmonicPatterns, dualScenarios, monteCarloExtended,
        // NEW v2 fields
        rsiMomentum, obvSlope, emaCrossover, macdSlope, macdAccel,
        takerData, openInterestData, atrPercentile,
        regimeMC, bayesian, riskOfRuin, scaleOut,
      };

      if (!hasRealVolume) {
        dataWarnings.push("volume_unavailable");
        if (assetType === "forex") dataWarnings.push("forex_no_public_volume");
      }
      if (assetType === "forex") dataWarnings.push("forex_ohlc_derived_from_close");

      realDataPayload = `
DADOS REAIS DO MERCADO — Fonte: ${dataSource}
Tipo: ${assetType} | Volume Real: ${hasRealVolume ? "SIM" : "NÃO"} | Timestamp: ${new Date().toISOString()}

⚠️ IMPORTANTE: O SINAL JÁ FOI CALCULADO DETERMINISTICAMENTE. Você NÃO decide o sinal.
SINAL DETERMINÍSTICO: ${signal}
CONFIANÇA: ${deterministicSignal.confidence}%
FORÇA DO SINAL: ${deterministicSignal.signalStrength}%
TIER 1 (Estrutura): ${deterministicSignal.tier1Direction}
TIER 2 (Momentum): ${deterministicSignal.tier2Direction}
HTF (${htfBinanceInterval || "N/A"}): ${htfBias || "N/A"} — ${deterministicSignal.htfAgreement ? "CONFIRMA ✅" : "REJEITA ❌"}

=== INDICADORES CORE (Wilder's Smoothing) ===
- Preço Atual (Spot): ${currentPrice}
- RSI(14) Wilder: ${rsi.toFixed(2)} (Zonas dinâmicas: OB>${rsiOBLevel}, OS<${rsiOSLevel})
- MACD: value=${macd.value.toFixed(6)}, signal=${macd.signal.toFixed(6)}, histogram=${macd.histogram.toFixed(6)}
- ATR(14) Wilder: ${atr.toFixed(6)}
- ADX(14) Wilder: ${adx.toFixed(2)} | +DI: ${plusDI.toFixed(2)} | -DI: ${minusDI.toFixed(2)} → ${plusDI > minusDI ? "COMPRADORES dominam" : "VENDEDORES dominam"}
- Bollinger(20): upper=${bollinger.upper.toFixed(2)}, middle=${bollinger.middle.toFixed(2)}, lower=${bollinger.lower.toFixed(2)}
- Stochastic: %K=${stoch.k.toFixed(2)}, %D=${stoch.d.toFixed(2)} (Zonas: OB>${stochOBLevel}, OS<${stochOSLevel})
- MFI(14): ${hasRealVolume ? mfi.toFixed(2) : "N/A"}
- CCI(20): ${cci.toFixed(2)}
- EMA20: ${ema20Val.toFixed(2)}, EMA50: ${ema50Val.toFixed(2)}, EMA200: ${ema200Val.toFixed(2)}

=== STOP LOSS ESTRUTURAL ===
- Método: ${slResult.method}
- Stop Loss: ${slResult.stopLoss} (distância: ${slDistance.toFixed(2)})
- TP1 (1:1): ${(signal === "COMPRA" ? currentPrice + slDistance : currentPrice - slDistance).toFixed(6)}
- TP2 (1:2): ${(signal === "COMPRA" ? currentPrice + 2 * slDistance : currentPrice - 2 * slDistance).toFixed(6)}
- TP3 (1:3): ${(signal === "COMPRA" ? currentPrice + 3 * slDistance : currentPrice - 3 * slDistance).toFixed(6)}

=== BACKTEST REALISTA (SL=${slDistance.toFixed(2)}, TP=1:1/1:2/1:3) ===
- Trades testados: ${backtest.total} | Wins: ${backtest.wins} | Losses: ${backtest.losses}
- Win Rate: ${backtest.winRate}% | Avg R:R: ${backtest.avgRR}
- TP1 Hits: ${backtest.tp1Hits} | TP2 Hits: ${backtest.tp2Hits} | TP3 Hits: ${backtest.tp3Hits}

=== KELLY CRITERION ===
- Kelly Full: ${kelly.kellyPct}%, Half-Kelly: ${kelly.halfKellyPct}%
- ${kelly.recommendation}

=== CONFLUÊNCIA PONDERADA (${weightedSignals.length} sinais) ===
- COMPRA: ${deterministicSignal.totalBuy} / ${deterministicSignal.maxWeight} (${(deterministicSignal.totalBuy / deterministicSignal.maxWeight * 100).toFixed(0)}%)
- VENDA: ${deterministicSignal.totalSell} / ${deterministicSignal.maxWeight} (${(deterministicSignal.totalSell / deterministicSignal.maxWeight * 100).toFixed(0)}%)
${weightedSignals.map(s => `  [T${s.tier}] [${s.direction.padEnd(7)}] ${s.name.padEnd(18)} peso=${s.weight.toFixed(1)}`).join("\n")}

=== SMC ===
- Order Blocks: ${JSON.stringify(orderBlocks)}
- FVGs: ${JSON.stringify(fvgs)}
- BOS: ${bos}
- Liquidity Zones: ${JSON.stringify(liquidityZones)}

${fibonacci ? `=== FIBONACCI ===
- Swing: ${fibonacci.swingHigh.toFixed(2)} / ${fibonacci.swingLow.toFixed(2)} | Tendência: ${fibonacci.isUptrend ? "ALTA" : "BAIXA"}
- Níveis: 23.6%=${fibonacci.level_236.toFixed(2)}, 38.2%=${fibonacci.level_382.toFixed(2)}, 50%=${fibonacci.level_500.toFixed(2)}, 61.8%=${fibonacci.level_618.toFixed(2)}
- Mais próximo: ${fibonacci.nearestLevel} ($${fibonacci.nearestPrice.toFixed(2)})` : ""}

=== SESSÃO: ${marketSession.session} — ${marketSession.volatilityExpectation} ===

${volumeDelta ? `=== VOLUME DELTA: ${volumeDelta.pressure} (Ratio: ${volumeDelta.ratio}) ===` : ""}

${fearGreedData ? `=== FEAR & GREED: ${fearGreedData.value}/100 (${fearGreedData.classification}) ===` : ""}
${fundingRateData !== null ? `=== FUNDING RATE: ${(fundingRateData * 100).toFixed(4)}% ===` : ""}

${globalData ? `=== BTC Dominance: ${globalData.btcDominance.toFixed(1)}% | Market 24h: ${globalData.btcChange24h.toFixed(2)}% ===` : ""}

=== QUANTITATIVO ===
- Monte Carlo: ${monteCarlo.bullPct.toFixed(1)}% Alta / ${monteCarlo.bearPct.toFixed(1)}% Baixa
- Sharpe: ${quantMetrics.sharpe.toFixed(2)}, Sortino: ${quantMetrics.sortino.toFixed(2)}
- Max Drawdown: ${quantMetrics.maxDrawdown.toFixed(2)}%, VaR 95%: ${quantMetrics.var95.toFixed(2)}%

REGRAS PARA A IA:
1. O SINAL É ${signal} — NÃO MUDE. Use exatamente este valor no header.signal
2. Use final_confidence_pct = ${deterministicSignal.confidence}
3. Use signal_strength_pct = ${deterministicSignal.signalStrength}
4. entry_price = ${currentPrice}
5. stop_loss = ${slResult.stopLoss} (estrutural: ${slResult.method})
6. Copie TODOS os valores numéricos EXATAMENTE
7. No executive_summary: explique POR QUE o sinal é ${signal}, mencione o HTF (${htfBias || "N/A"}) e o backtest (WR=${backtest.winRate}%)
8. Interprete Wyckoff/Elliott/Gann/Dow com base nos indicadores calculados — NÃO invente fases`;

    } else {
      console.error(`[ANALYZE] ❌ NO REAL DATA for ${asset} (${timeframe}) — marketData is null. Rejecting analysis.`);
      return new Response(JSON.stringify({ 
        error: `Dados reais indisponíveis para ${asset}. Nenhuma fonte de dados real respondeu. Tente novamente.`,
        _no_real_data: true 
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== STEP 2: Deterministic synthesis (AI narratives disabled — available on-demand) ==========
    dataWarnings.push("ai_narrative_on_demand");

    let analysisJson: any = buildFallbackAnalysisJson({
      asset,
      timeframe: timeframe || "1H",
      ci: calculatedIndicators,
      dataSource,
      fallbackReason: "on_demand",
    });
    console.log(`[ANALYZE] Using deterministic synthesis (AI narratives available on-demand via generate-ai-narrative)`);

    // ========== STEP 3: POST-AI VALIDATION — FORCE all calculated values ==========
    if (calculatedIndicators) {
      const ci = calculatedIndicators;
      console.log(`[VALIDATE] Overriding AI values with calculated data...`);

      // FORCE the deterministic signal
      if (!analysisJson.header) analysisJson.header = {};
      analysisJson.header.signal = ci.signal;
      analysisJson.header.signal_strength_pct = parseFloat(ci.confluence.signalStrength.toFixed(0));
      analysisJson.header.final_confidence_pct = parseFloat(ci.confluence.confidence.toFixed(0));
      
      // Determine trend from structure
      const ema20V = ci.ema20, ema50V = ci.ema50, ema200V = ci.ema200;
      if (ema20V > ema50V && ema50V > ema200V) analysisJson.header.trend = "ALTA";
      else if (ema20V < ema50V && ema50V < ema200V) analysisJson.header.trend = "BAIXA";
      else analysisJson.header.trend = "LATERAL";

      // Override technical indicators
      if (!analysisJson.technical_indicators) analysisJson.technical_indicators = {};
      analysisJson.technical_indicators.rsi = { ...analysisJson.technical_indicators.rsi, value: parseFloat(ci.rsi.toFixed(2)) };
      analysisJson.technical_indicators.macd = {
        ...analysisJson.technical_indicators.macd,
        value: parseFloat(ci.macd.value.toFixed(6)),
        signal_line: parseFloat(ci.macd.signal.toFixed(6)),
        histogram: parseFloat(ci.macd.histogram.toFixed(6)),
      };
      analysisJson.technical_indicators.adx = { ...analysisJson.technical_indicators.adx, value: parseFloat(ci.adx.toFixed(2)) };
      analysisJson.technical_indicators.ema_20 = parseFloat(ci.ema20.toFixed(6));
      analysisJson.technical_indicators.ema_50 = parseFloat(ci.ema50.toFixed(6));
      analysisJson.technical_indicators.ema_200 = parseFloat(ci.ema200.toFixed(6));
      analysisJson.technical_indicators.bollinger = {
        upper: parseFloat(ci.bollinger.upper.toFixed(6)),
        middle: parseFloat(ci.bollinger.middle.toFixed(6)),
        lower: parseFloat(ci.bollinger.lower.toFixed(6)),
      };
      analysisJson.technical_indicators.stochastic = {
        k: parseFloat(ci.stochastic.k.toFixed(2)),
        d: parseFloat(ci.stochastic.d.toFixed(2)),
      };
      analysisJson.technical_indicators.mfi = parseFloat(ci.mfi.toFixed(2));
      analysisJson.technical_indicators.cci = parseFloat(ci.cci.toFixed(2));
      analysisJson.technical_indicators.buy_signals = ci.buySignals;
      analysisJson.technical_indicators.sell_signals = ci.sellSignals;
      analysisJson.technical_indicators.neutral_signals = ci.neutralSignals;

      // Advanced indicators
      analysisJson.technical_indicators.vwap = parseFloat(ci.vwap.toFixed(2));
      analysisJson.technical_indicators.ichimoku = ci.ichimoku;
      analysisJson.technical_indicators.obv = ci.obv;
      analysisJson.technical_indicators.ad_line = ci.adLine;
      analysisJson.technical_indicators.pivot_points = ci.pivots;
      analysisJson.technical_indicators.candle_patterns = ci.candlePatterns;
      analysisJson.technical_indicators.divergences = ci.divergences;
      analysisJson.technical_indicators.regime = ci.regime;
      analysisJson.technical_indicators.confluence = {
        buy_score: ci.confluence.totalBuy,
        sell_score: ci.confluence.totalSell,
        max_score: ci.confluence.maxWeight,
        confidence: ci.confluence.confidence,
      };

      // FORCE risk management with structural SL
      if (!analysisJson.risk_management) analysisJson.risk_management = {};
      const entry = ci.currentPrice;
      const sl = ci.slResult.stopLoss;
      const slDist = ci.slDistance;
      
      analysisJson.risk_management.entry_price = parseFloat(entry.toFixed(6));
      analysisJson.risk_management.atr_value = parseFloat(ci.atr.toFixed(6));
      analysisJson.risk_management.stop_loss = sl;
      
      if (ci.signal === "COMPRA") {
        analysisJson.risk_management.take_profit_1 = parseFloat((entry + slDist).toFixed(6));
        analysisJson.risk_management.take_profit_2 = parseFloat((entry + 2 * slDist).toFixed(6));
        analysisJson.risk_management.take_profit_3 = parseFloat((entry + 3 * slDist).toFixed(6));
      } else if (ci.signal === "VENDA") {
        analysisJson.risk_management.take_profit_1 = parseFloat((entry - slDist).toFixed(6));
        analysisJson.risk_management.take_profit_2 = parseFloat((entry - 2 * slDist).toFixed(6));
        analysisJson.risk_management.take_profit_3 = parseFloat((entry - 3 * slDist).toFixed(6));
      } else {
        // NEUTRO — still provide reference levels
        analysisJson.risk_management.take_profit_1 = parseFloat((entry + slDist).toFixed(6));
        analysisJson.risk_management.take_profit_2 = parseFloat((entry + 2 * slDist).toFixed(6));
        analysisJson.risk_management.take_profit_3 = parseFloat((entry + 3 * slDist).toFixed(6));
      }
      analysisJson.risk_management.risk_pct = parseFloat((slDist / entry * 100).toFixed(2));

      // Override quantitative
      if (!analysisJson.quantitative) analysisJson.quantitative = {};
      analysisJson.quantitative.monte_carlo_bull_pct = parseFloat(ci.monteCarlo.bullPct.toFixed(1));
      analysisJson.quantitative.monte_carlo_bear_pct = parseFloat(ci.monteCarlo.bearPct.toFixed(1));
      analysisJson.quantitative.sharpe_ratio = parseFloat(ci.quantMetrics.sharpe.toFixed(2));
      analysisJson.quantitative.sortino_ratio = parseFloat(ci.quantMetrics.sortino.toFixed(2));
      analysisJson.quantitative.max_drawdown_pct = parseFloat(ci.quantMetrics.maxDrawdown.toFixed(2));
      analysisJson.quantitative.var_95_pct = parseFloat(ci.quantMetrics.var95.toFixed(2));
      analysisJson.quantitative.win_rate_historical = parseFloat(ci.quantMetrics.winRate.toFixed(1));

      // Override SMC
      if (smcData) {
        if (!analysisJson.smc_analysis) analysisJson.smc_analysis = {};
        if (smcData.orderBlocks.length > 0) analysisJson.smc_analysis.order_blocks = smcData.orderBlocks;
        if (smcData.fvgs.length > 0) analysisJson.smc_analysis.fair_value_gaps = smcData.fvgs;
        analysisJson.smc_analysis.break_of_structure = smcData.bos;
        if (smcData.liquidityZones.length > 0) analysisJson.smc_analysis.liquidity_zones = smcData.liquidityZones;
      }

      // Cross-asset
      if (ci.globalData) {
        analysisJson._cross_asset = {
          btc_dominance: ci.globalData.btcDominance,
          market_change_24h: ci.globalData.btcChange24h,
        };
      }

      // Attach candle data for chart
      if (marketData) {
        const candles = marketData.timestamps.map((t: number, i: number) => ({
          time: Math.floor(t / 1000),
          open: marketData.opens[i],
          high: marketData.highs[i],
          low: marketData.lows[i],
          close: marketData.closes[i],
          volume: marketData.volumes[i],
        }));
        analysisJson._candles = candles;
      }

      // Metadata
      analysisJson._has_real_data = true;
      analysisJson._data_source = dataSource;
      analysisJson._has_real_volume = marketData?.hasRealVolume || false;
      analysisJson._asset_type = marketData?.assetType || "unknown";
      analysisJson._data_warnings = dataWarnings;
      analysisJson._analysis_timestamp = ci.analysisTs;
      analysisJson._fibonacci = ci.fibonacci;
      analysisJson._atr_trailing = ci.atrTrailing;
      analysisJson._market_session = ci.marketSession;
      analysisJson._liquidation_levels = ci.liquidationLevels;
      analysisJson._volume_delta = ci.volumeDelta;
      analysisJson._fear_greed = ci.fearGreedData;
      analysisJson._funding_rate = ci.fundingRateData;
      analysisJson._backtest = ci.backtest;
      analysisJson._kelly = ci.kelly;
      analysisJson._confidence_decay = calcConfidenceDecay(ci.analysisTs, ci.confluence.confidence);
      analysisJson._sl_method = ci.slResult.method;
      analysisJson._htf_bias = ci.htfBias;
      analysisJson._htf_timeframe = htfBinanceInterval;
      analysisJson._signal_deterministic = true;
      // NEW v2 metadata
      analysisJson._rsi_momentum = ci.rsiMomentum;
      analysisJson._obv_slope = ci.obvSlope;
      analysisJson._ema_crossover = ci.emaCrossover;
      analysisJson._macd_slope = ci.macdSlope;
      analysisJson._taker_data = ci.takerData;
      analysisJson._open_interest = ci.openInterestData;
      analysisJson._atr_percentile = ci.atrPercentile;
      analysisJson._regime_monte_carlo = ci.regimeMC;
      analysisJson._bayesian = ci.bayesian;
      analysisJson._risk_of_ruin = ci.riskOfRuin;
      analysisJson._scale_out = ci.scaleOut;
      analysisJson._harmonic_patterns = ci.harmonicPatterns;
      analysisJson._dual_scenarios = ci.dualScenarios;
      analysisJson._monte_carlo_extended = ci.monteCarloExtended;
      analysisJson._smc_status = ci.smcStatus;

      // ========== STEP 4: MASTER AGENT — Meta-evaluation & coherence audit ==========
      const master = masterAgentEvaluate(analysisJson, ci);
      
      // Apply Master Agent corrections
      if (master.correctedSignal) {
        analysisJson.header.signal = master.correctedSignal;
      }
      if (master.correctedConfidence !== null) {
        analysisJson.header.final_confidence_pct = master.correctedConfidence;
      }
      
      // Attach Master Agent metadata
      analysisJson._master = master.result;
    }

    console.log(`[ANALYZE] Done. Source: ${dataSource} | Signal: ${analysisJson?.header?.signal || "N/A"} | Confidence: ${analysisJson?.header?.final_confidence_pct || "N/A"}% | Master: ${analysisJson?._master?.verdict || "N/A"} | HTF: ${htfBias || "N/A"}`);

    return new Response(JSON.stringify(analysisJson), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Analyze error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ============================================================
// MASTER AGENT — Meta-evaluation layer
// ============================================================

interface MasterResult {
  verdict: "CONFIRMED" | "DOWNGRADED" | "OVERRIDDEN_TO_NEUTRAL" | "FLAGGED";
  quality_score: number; // 0-100
  adjustments: string[];
  warnings: string[];
  subsystem_agreement: number; // how many subsystems agree (0-1)
  original_confidence: number;
  original_signal: string;
}

function masterAgentEvaluate(json: any, ci: any): { result: MasterResult; correctedSignal: string | null; correctedConfidence: number | null } {
  const signal = json.header?.signal || "NEUTRO";
  const confidence = json.header?.final_confidence_pct || 50;
  const adjustments: string[] = [];
  const warnings: string[] = [];
  let correctedConfidence = confidence;
  let correctedSignal: string | null = null;
  let conflicts = 0;
  const totalChecks = 7;
  let agreements = 0;

  const isBuy = signal === "COMPRA";
  const isSell = signal === "VENDA";
  const isDirectional = isBuy || isSell;

  // ── AUDIT 1: Signal vs HTF Bias ──
  const htfBias = json._htf_bias;
  if (isDirectional && htfBias) {
    const htfAgrees = (isBuy && htfBias === "BUY") || (isSell && htfBias === "SELL");
    const htfConflicts = (isBuy && htfBias === "SELL") || (isSell && htfBias === "BUY");
    if (htfAgrees) {
      agreements++;
    } else if (htfConflicts) {
      conflicts++;
      correctedConfidence = Math.min(correctedConfidence, correctedConfidence * 0.7);
      adjustments.push(`Confiança reduzida: sinal ${signal} conflita com HTF bias ${htfBias}`);
    }
  } else if (!isDirectional) { agreements++; }

  // ── AUDIT 2: Signal vs Momentum Slopes ──
  const rsiSlope = json._rsi_momentum?.slope || 0;
  const macdSlope = json._macd_slope || 0;
  const obvTrend = json._obv_slope?.obvTrend || "neutral";
  let momentumConflicts = 0;
  if (isBuy) {
    if (rsiSlope < -0.5) momentumConflicts++;
    if (macdSlope < 0) momentumConflicts++;
    if (obvTrend === "falling") momentumConflicts++;
  } else if (isSell) {
    if (rsiSlope > 0.5) momentumConflicts++;
    if (macdSlope > 0) momentumConflicts++;
    if (obvTrend === "rising") momentumConflicts++;
  }
  if (momentumConflicts >= 2) {
    conflicts++;
    correctedConfidence -= 8;
    adjustments.push(`Momentum divergente: ${momentumConflicts}/3 slopes contra o sinal`);
  } else { agreements++; }

  // ── AUDIT 3: Confidence vs Backtest Winrate ──
  const winRate = json._backtest?.winRate ?? 50;
  if (winRate < 40 && correctedConfidence > 55) {
    correctedConfidence = Math.min(correctedConfidence, 55);
    conflicts++;
    adjustments.push(`Confiança capada em 55%: backtest winrate ${winRate.toFixed(0)}% < 40%`);
  } else { agreements++; }

  // ── AUDIT 4: Risk of Ruin check ── (WARNING ONLY — RoR is about sizing, not signal quality)
  const ror = json._risk_of_ruin?.riskOfRuin ?? 0;
  if (ror > 20) {
    warnings.push(`⚠️ Risk of Ruin ${ror.toFixed(1)}% — risco elevado de ruína com sizing atual`);
    // Do NOT penalize confidence — RoR is a position sizing issue, not signal quality
    // Just add warning for the user to reduce position size
  }
  agreements++; // RoR doesn't count as a conflict anymore

  // ── AUDIT 5: Bayesian vs Confluence divergence ──
  const bayesianPosterior = json._bayesian?.posterior ?? confidence;
  const confluenceConf = ci?.confluence?.confidence ?? confidence;
  const bayesDelta = Math.abs(bayesianPosterior - confluenceConf);
  if (bayesDelta > 30) {
    conflicts++;
    const avg = (bayesianPosterior + confluenceConf) / 2;
    correctedConfidence = Math.round(avg);
    adjustments.push(`Bayesian (${bayesianPosterior.toFixed(0)}%) e Confluência (${confluenceConf.toFixed(0)}%) divergem ${bayesDelta.toFixed(0)}pp — confiança ajustada para média`);
  } else { agreements++; }

  // ── AUDIT 6: Taker/OI pressure vs Signal ──
  const takerPressure = json._taker_data?.pressure;
  const oiChange = json._open_interest?.oiChange ?? 0;
  if (isDirectional && takerPressure) {
    const takerConflicts = (isBuy && takerPressure === "SELL") || (isSell && takerPressure === "BUY");
    if (takerConflicts && oiChange > 0) {
      conflicts++;
      correctedConfidence -= 5;
      adjustments.push(`Taker pressure (${takerPressure}) contra sinal com OI crescente`);
    } else { agreements++; }
  } else { agreements++; }

  // ── AUDIT 7: Simulated data cap ──
  if (!json._has_real_data) {
    if (correctedConfidence > 50) {
      correctedConfidence = 50;
      adjustments.push("Confiança capada em 50%: dados simulados");
    }
    warnings.push("Análise baseada em dados simulados — use apenas como referência");
    conflicts++;
  } else { agreements++; }

  // ── VOLUME RELIABILITY ──
  if (!json._has_real_volume && isDirectional) {
    if (json.technical_indicators) {
      warnings.push("Indicadores de volume (MFI, OBV, Volume Delta) sem dados reais — peso reduzido");
    }
  }

  // ── MARGINAL SIGNAL CHECK ──
  const buyScore = ci?.confluence?.totalBuy ?? 0;
  const sellScore = ci?.confluence?.totalSell ?? 0;
  const scoreDelta = Math.abs(buyScore - sellScore);
  const maxScore = ci?.confluence?.maxWeight ?? 1;
  if (isDirectional && scoreDelta < maxScore * 0.05) {
    correctedSignal = "NEUTRO";
    adjustments.push(`Sinal forçado NEUTRO: diferença buy/sell marginal (${scoreDelta.toFixed(2)}/${maxScore.toFixed(2)})`);
    conflicts++;
  }

  // ── CONFIDENCE FLOOR: directional signals should have minimum 40% ──
  // If we're emitting a directional signal, confidence below 40% makes it meaningless
  if (isDirectional && !correctedSignal && correctedConfidence < 40) {
    correctedConfidence = 40;
  }

  // ── CAP TOTAL PENALTY: confidence never drops more than 40% from original ──
  const minAllowedConfidence = confidence * 0.60;
  if (correctedConfidence < minAllowedConfidence) {
    correctedConfidence = Math.round(minAllowedConfidence);
    console.log(`[MASTER] Confidence floor applied: capped at 60% of original (${confidence} → ${correctedConfidence})`);
  }

  // ── FINAL VERDICT ──
  correctedConfidence = Math.max(0, Math.min(100, Math.round(correctedConfidence)));
  const subsystemAgreement = agreements / totalChecks;

  // Override to NEUTRAL only if 4+ major conflicts (raised from 3)
  if (conflicts >= 4 && isDirectional && !correctedSignal) {
    correctedSignal = "NEUTRO";
    adjustments.push(`Sinal sobrescrito para NEUTRO: ${conflicts} subsistemas em conflito`);
  }

  let verdict: MasterResult["verdict"];
  if (correctedSignal === "NEUTRO" && signal !== "NEUTRO") {
    verdict = "OVERRIDDEN_TO_NEUTRAL";
  } else if (adjustments.length === 0) {
    verdict = "CONFIRMED";
  } else if (correctedConfidence < confidence - 10) {
    verdict = "DOWNGRADED";
  } else if (warnings.length > 0 || adjustments.length > 0) {
    verdict = "FLAGGED";
  } else {
    verdict = "CONFIRMED";
  }

  const qualityScore = Math.round(
    subsystemAgreement * 40 +
    Math.min(correctedConfidence, 100) * 0.3 +
    Math.min(winRate, 100) * 0.2 +
    (json._has_real_data ? 10 : 0)
  );

  console.log(`[MASTER] Verdict: ${verdict} | Quality: ${qualityScore} | Conflicts: ${conflicts}/${totalChecks} | Adj: ${adjustments.length} | Warnings: ${warnings.length}`);

  return {
    result: {
      verdict,
      quality_score: qualityScore,
      adjustments,
      warnings,
      subsystem_agreement: parseFloat(subsystemAgreement.toFixed(2)),
      original_confidence: confidence,
      original_signal: signal,
    },
    correctedSignal: correctedSignal !== signal ? correctedSignal : null,
    correctedConfidence: correctedConfidence !== confidence ? correctedConfidence : null,
  };
}
