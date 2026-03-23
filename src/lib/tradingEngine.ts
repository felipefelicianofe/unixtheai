// ============================================================
// TRADING ENGINE — Autonomous Execution Logic
// ============================================================

export interface BrokerCredentials {
  broker: "binance_futures" | "bybit";
  apiKey: string;
  apiSecret: string;
}

export interface ConnectionStatus {
  connected: boolean;
  pingMs: number;
  accountBalance: number;
  availableBalance: number;
  totalPnl: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  roe: number;
  stopLoss: number;
  takeProfit: number;
  leverage: number;
  trailingActive: boolean;
  breakEven: boolean;
  timestamp: number;
}

export interface OrderResult {
  orderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: string;
  quantity: number;
  price: number;
  status: "FILLED" | "PENDING" | "REJECTED";
}

// ============================================================
// 1. POSITION SIZING (Kelly-Adjusted Risk Management)
// ============================================================

export function calculatePositionSize(
  accountBalance: number,
  riskPercentage: number,
  entryPrice: number,
  stopLossPrice: number,
  leverage: number = 1
): { positionSize: number; riskAmount: number; lotSize: number; notionalValue: number } {
  const riskAmount = accountBalance * (riskPercentage / 100);
  const stopDistance = Math.abs(entryPrice - stopLossPrice) / entryPrice;
  
  if (stopDistance === 0) {
    return { positionSize: 0, riskAmount, lotSize: 0, notionalValue: 0 };
  }

  const positionSize = riskAmount / stopDistance;
  const lotSize = positionSize / entryPrice;
  const notionalValue = positionSize * leverage;

  return {
    positionSize: parseFloat(positionSize.toFixed(2)),
    riskAmount: parseFloat(riskAmount.toFixed(2)),
    lotSize: parseFloat(lotSize.toFixed(6)),
    notionalValue: parseFloat(notionalValue.toFixed(2)),
  };
}

// ============================================================
// 2. ORDER EXECUTION (Binance Futures Structure)
// ============================================================

export async function executeAIOrder(
  credentials: BrokerCredentials,
  symbol: string,
  side: "BUY" | "SELL",
  quantity: number,
  stopLossPrice: number,
  takeProfitPrice: number,
  leverage: number = 10
): Promise<{ entry: OrderResult; stopLoss: OrderResult; takeProfit: OrderResult }> {
  // In production, this would use ccxt:
  // const exchange = new ccxt.binance({
  //   apiKey: credentials.apiKey,
  //   secret: credentials.apiSecret,
  //   options: { defaultType: 'future' },
  // });
  // await exchange.setLeverage(leverage, symbol);
  // const entry = await exchange.createMarketOrder(symbol, side, quantity);
  // const sl = await exchange.createOrder(symbol, 'STOP_MARKET', inverseSide, quantity, stopLossPrice, { reduceOnly: true, stopPrice: stopLossPrice });
  // const tp = await exchange.createOrder(symbol, 'TAKE_PROFIT_MARKET', inverseSide, quantity, takeProfitPrice, { reduceOnly: true, stopPrice: takeProfitPrice });

  const now = Date.now();
  const inverseSide = side === "BUY" ? "SELL" : "BUY";

  return {
    entry: {
      orderId: `ENT-${now}`,
      symbol,
      side,
      type: "MARKET",
      quantity,
      price: 0, // Filled at market
      status: "FILLED",
    },
    stopLoss: {
      orderId: `SL-${now}`,
      symbol,
      side: inverseSide,
      type: "STOP_MARKET",
      quantity,
      price: stopLossPrice,
      status: "PENDING",
    },
    takeProfit: {
      orderId: `TP-${now}`,
      symbol,
      side: inverseSide,
      type: "TAKE_PROFIT_MARKET",
      quantity,
      price: takeProfitPrice,
      status: "PENDING",
    },
  };
}

// ============================================================
// 3. TRAILING STOP MONITOR
// ============================================================

export function trailingStopMonitor(
  position: Position,
  currentPrice: number,
  breakEvenThresholdPct: number = 2.0,
  trailStepPct: number = 1.0
): { newStopLoss: number; isBreakEven: boolean; shouldUpdate: boolean } {
  const isLong = position.side === "LONG";
  const priceDiffPct = isLong
    ? ((currentPrice - position.entryPrice) / position.entryPrice) * 100
    : ((position.entryPrice - currentPrice) / position.entryPrice) * 100;

  let newStopLoss = position.stopLoss;
  let isBreakEven = position.breakEven;
  let shouldUpdate = false;

  // Stage 1: Move to break-even when price moves 2% in favor
  // True Breakeven accounts for fees + slippage (0.12% = 0.0012)
  if (priceDiffPct >= breakEvenThresholdPct && !position.breakEven) {
    const trueBE = isLong
      ? position.entryPrice * (1 + 0.0012)
      : position.entryPrice * (1 - 0.0012);
    newStopLoss = trueBE;
    isBreakEven = true;
    shouldUpdate = true;
  }

  // Stage 2: Trail stop further as price continues to move in favor
  if (priceDiffPct >= breakEvenThresholdPct + trailStepPct) {
    const trailDistance = (priceDiffPct - breakEvenThresholdPct) * 0.5; // Trail at 50% of gains
    if (isLong) {
      const candidateStop = position.entryPrice * (1 + trailDistance / 100);
      if (candidateStop > newStopLoss) {
        newStopLoss = candidateStop;
        shouldUpdate = true;
      }
    } else {
      const candidateStop = position.entryPrice * (1 - trailDistance / 100);
      if (candidateStop < newStopLoss) {
        newStopLoss = candidateStop;
        shouldUpdate = true;
      }
    }
  }

  return {
    newStopLoss: parseFloat(newStopLoss.toFixed(2)),
    isBreakEven,
    shouldUpdate,
  };
}

// ============================================================
// 4. MOCK DATA GENERATORS (for UI preview)
// ============================================================

export function generateMockPositions(): Position[] {
  return [
    {
      id: "pos-1",
      symbol: "BTC/USDT",
      side: "LONG",
      size: 0.045,
      entryPrice: 68420.50,
      currentPrice: 69353.66,
      pnl: 41.94,
      roe: 15.42,
      stopLoss: 67200.00,
      takeProfit: 72500.00,
      leverage: 10,
      trailingActive: true,
      breakEven: true,
      timestamp: Date.now() - 3600000,
    },
    {
      id: "pos-2",
      symbol: "ETH/USDT",
      side: "SHORT",
      size: 1.2,
      entryPrice: 3845.20,
      currentPrice: 3812.45,
      pnl: 39.30,
      roe: 8.16,
      stopLoss: 3920.00,
      takeProfit: 3650.00,
      leverage: 5,
      trailingActive: false,
      breakEven: false,
      timestamp: Date.now() - 1800000,
    },
    {
      id: "pos-3",
      symbol: "SOL/USDT",
      side: "LONG",
      size: 15.5,
      entryPrice: 148.32,
      currentPrice: 146.88,
      pnl: -22.32,
      roe: -4.51,
      stopLoss: 142.00,
      takeProfit: 162.00,
      leverage: 10,
      trailingActive: false,
      breakEven: false,
      timestamp: Date.now() - 900000,
    },
  ];
}

export function generateMockConnectionStatus(): ConnectionStatus {
  return {
    connected: true,
    pingMs: 14,
    accountBalance: 5432.00,
    availableBalance: 3218.45,
    totalPnl: 58.92,
  };
}

// ============================================================
// 5. LIQUIDITY SWEEP CHECK (Pre-execution gate)
// ============================================================

export interface LiquidityCheck {
  safe: boolean;
  nearestCluster: { price: number; volumeMillions: number; distancePct: number } | null;
  recommendation: string;
}

export function checkLiquiditySweep(
  targetPrice: number,
  liquidityClusters: Array<{ price: number; volumeMillions: number }>,
  thresholdPct: number = 0.5
): LiquidityCheck {
  // Find clusters within threshold% of target entry
  const nearClusters = liquidityClusters
    .map((c) => ({
      ...c,
      distancePct: Math.abs((c.price - targetPrice) / targetPrice) * 100,
    }))
    .filter((c) => c.distancePct <= thresholdPct)
    .sort((a, b) => b.volumeMillions - a.volumeMillions);

  if (nearClusters.length === 0) {
    return { safe: true, nearestCluster: null, recommendation: "Sem liquidez massiva próxima. Entrada segura." };
  }

  const biggest = nearClusters[0];
  // If >$30M in liquidations within 0.5%, delay entry
  if (biggest.volumeMillions > 30) {
    return {
      safe: false,
      nearestCluster: biggest,
      recommendation: `Aguardar sweep de $${biggest.volumeMillions.toFixed(0)}M em $${biggest.price.toLocaleString()}. Smart Money caçará esse nível primeiro.`,
    };
  }

  return { safe: true, nearestCluster: biggest, recommendation: "Liquidez próxima moderada. Entrada permitida com cautela." };
}

// ============================================================
// 6. MACRO SHIELD CHECK (Pre-execution gate)
// ============================================================

export interface MacroCheckResult {
  safe: boolean;
  alerts: Array<{ type: string; severity: "HIGH" | "MEDIUM" | "LOW"; message: string }>;
  blockedDirections: ("LONG" | "SHORT")[];
}

export function checkMacroShield(
  whaleAlert: boolean,
  newsSentiment: "BULLISH" | "NEUTRAL" | "PANIC",
  fearGreedIndex: number,
  fundingRate: number
): MacroCheckResult {
  const alerts: MacroCheckResult["alerts"] = [];
  const blocked: ("LONG" | "SHORT")[] = [];

  if (whaleAlert) {
    alerts.push({ type: "WHALE_ALERT", severity: "HIGH", message: "Influxo massivo de baleia detectado. Risco de dump." });
    blocked.push("LONG");
  }

  if (newsSentiment === "PANIC") {
    alerts.push({ type: "NEWS_PANIC", severity: "HIGH", message: "Sentimento de pânico no mercado." });
    blocked.push("LONG");
  }

  if (fearGreedIndex < 15) {
    alerts.push({ type: "EXTREME_FEAR", severity: "MEDIUM", message: `Fear & Greed em ${fearGreedIndex}. Mercado em pânico.` });
  }

  if (fundingRate > 0.001) {
    alerts.push({ type: "FUNDING_EXTREME", severity: "MEDIUM", message: `Funding Rate em ${(fundingRate * 100).toFixed(3)}%. Longs sobrecarregados.` });
    blocked.push("LONG");
  } else if (fundingRate < -0.001) {
    alerts.push({ type: "FUNDING_EXTREME", severity: "MEDIUM", message: `Funding Rate negativo em ${(fundingRate * 100).toFixed(3)}%. Shorts sobrecarregados.` });
    blocked.push("SHORT");
  }

  return {
    safe: alerts.filter((a) => a.severity === "HIGH").length === 0,
    alerts,
    blockedDirections: [...new Set(blocked)],
  };
}

// ============================================================
// 7. DAILY LIMITS VERIFICATION (Kill Switch)
// ============================================================

export interface DailyLimitsResult {
  canTrade: boolean;
  reason: string | null;
  dailyPnl: number;
  profitGoalReached: boolean;
  maxLossReached: boolean;
}

export function verifyDailyLimits(
  dailyPnl: number,
  profitGoal: number,
  maxLoss: number
): DailyLimitsResult {
  if (dailyPnl >= profitGoal) {
    return {
      canTrade: false,
      reason: `Meta diária atingida (+$${dailyPnl.toFixed(2)}). Robô pausado para proteger lucros.`,
      dailyPnl,
      profitGoalReached: true,
      maxLossReached: false,
    };
  }

  if (dailyPnl <= -maxLoss) {
    return {
      canTrade: false,
      reason: `Limite de perda diária atingido (-$${Math.abs(dailyPnl).toFixed(2)}). Robô pausado para proteger capital.`,
      dailyPnl,
      profitGoalReached: false,
      maxLossReached: true,
    };
  }

  return {
    canTrade: true,
    reason: null,
    dailyPnl,
    profitGoalReached: false,
    maxLossReached: false,
  };
}
