import { useEffect, useRef, useState, useCallback } from "react";

export interface TickerData {
  price: number;
  priceChange: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}

export interface KlineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

export type ConnectionStatus = "connecting" | "live" | "stale" | "disconnected" | "fallback";

interface UseBinanceSocketOptions {
  symbol: string;
  enabled?: boolean;
  klineInterval?: string;
}

interface UseBinanceSocketReturn {
  ticker: TickerData | null;
  lastKline: KlineData | null;
  connected: boolean;
  connectionStatus: ConnectionStatus;
  priceDirection: "up" | "down" | null;
  prevPrice: number | null;
  lastTickAge: number; // seconds since last tick
}

const RECONNECT_DELAY = 2000;
const MAX_RECONNECTS = 15;
const STALE_THRESHOLD_MS = 10_000; // 10s without tick = stale
const REST_POLL_INTERVAL = 2000; // 2s REST fallback

// ── Clock sync with Binance server ──
let _serverTimeOffset = 0;
let _offsetFetched = false;

async function syncServerTime() {
  try {
    const before = Date.now();
    const res = await fetch("https://api.binance.com/api/v3/time");
    const after = Date.now();
    const { serverTime } = await res.json();
    const latency = (after - before) / 2;
    _serverTimeOffset = serverTime - (before + latency);
    _offsetFetched = true;
    console.log(`[WS] Clock sync: offset=${_serverTimeOffset.toFixed(0)}ms, latency=${latency.toFixed(0)}ms`);
  } catch {
    console.warn("[WS] Clock sync failed, using local time");
    _serverTimeOffset = 0;
    _offsetFetched = true;
  }
}

function exchangeNow(): number {
  return Date.now() + _serverTimeOffset;
}

// ── Interval helpers ──
function intervalToMs(interval: string): number {
  const map: Record<string, number> = {
    "1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000,
    "30m": 1_800_000, "1h": 3_600_000, "2h": 7_200_000, "4h": 14_400_000,
    "6h": 21_600_000, "8h": 28_800_000, "12h": 43_200_000,
    "1d": 86_400_000, "1w": 604_800_000,
  };
  return map[interval.toLowerCase()] || 60_000;
}

function nextCandleCloseMs(intervalMs: number): number {
  const now = exchangeNow();
  return now - (now % intervalMs) + intervalMs;
}

// ── Dynamic symbol normalization ──
/**
 * Normalizes ANY user input to a valid Binance symbol.
 * Accepts: "BTC/USDT", "btcusdt", "BTC USDT", "btc-usdt", "BTC", "eth", "PEPE", etc.
 * Returns lowercase for WebSocket streams.
 */
export function toBinanceSymbol(asset: string): string | null {
  if (!asset || asset.trim().length === 0) return null;

  let clean = asset.trim().toUpperCase()
    .replace(/[\s/\-_.]+/g, "") // Remove separators
    .replace(/PERP$/, "");         // Remove "PERP" suffix

  // Skip clearly non-crypto assets
  if (/^(EUR|USD|GBP|JPY|CHF|AUD|CAD|NZD)(EUR|USD|GBP|JPY|CHF|AUD|CAD|NZD)$/.test(clean)) return null; // Forex pairs
  if (/^\d+$/.test(clean)) return null; // Pure numbers
  if (/^[A-Z]{4,6}\d{1,2}$/.test(clean)) return null; // Stock tickers like PETR4, VALE3

  // If already ends with a quote currency, use as-is
  const quoteCurrencies = ["USDT", "BUSD", "BRL", "USDC", "BTC", "ETH", "BNB", "FDUSD"];
  const hasQuote = quoteCurrencies.some(q => clean.endsWith(q) && clean.length > q.length);

  if (!hasQuote) {
    clean = clean + "USDT"; // Default to USDT pair
  }

  return clean.toLowerCase();
}

// ── REST fallback price fetcher ──
async function fetchRestPrice(symbol: string): Promise<{ price: number; timestamp: number } | null> {
  try {
    const upper = symbol.toUpperCase();
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${upper}`);
    if (!res.ok) return null;
    const data = await res.json();
    return { price: parseFloat(data.price), timestamp: Date.now() };
  } catch {
    return null;
  }
}

// ── Main hook ──
export function useBinanceSocket({ symbol, enabled = true, klineInterval = "1m" }: UseBinanceSocketOptions): UseBinanceSocketReturn {
  const [ticker, setTicker] = useState<TickerData | null>(null);
  const [lastKline, setLastKline] = useState<KlineData | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [priceDirection, setPriceDirection] = useState<"up" | "down" | null>(null);
  const [lastTickAge, setLastTickAge] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Candle close timer
  const candleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pollIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const latestKlineRef = useRef<KlineData | null>(null);
  const firedForCloseAt = useRef(0);

  // Stale detection
  const lastTickTime = useRef(Date.now());
  const staleCheckerRef = useRef<ReturnType<typeof setInterval>>();

  // REST fallback
  const restPollRef = useRef<ReturnType<typeof setInterval>>();
  const usingFallback = useRef(false);

  const cleanupTimers = useCallback(() => {
    if (candleTimerRef.current) clearTimeout(candleTimerRef.current);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  }, []);

  const cleanupAll = useCallback(() => {
    cleanupTimers();
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    if (staleCheckerRef.current) clearInterval(staleCheckerRef.current);
    if (restPollRef.current) clearInterval(restPollRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    usingFallback.current = false;
    setConnected(false);
    setConnectionStatus("disconnected");
  }, [cleanupTimers]);

  // ── Price updater (shared by WS and REST) ──
  const updatePrice = useCallback((newPrice: number, ts: number) => {
    lastTickTime.current = Date.now();
    setPrevPrice((prev) => {
      if (prev !== null && prev !== newPrice) {
        setPriceDirection(newPrice > prev ? "up" : "down");
        setTimeout(() => setPriceDirection(null), 300);
      }
      return newPrice;
    });
    return newPrice;
  }, []);

  // ── Candle close fire ──
  const fireCandleClose = useCallback((closeAt: number) => {
    if (firedForCloseAt.current === closeAt) return;
    firedForCloseAt.current = closeAt;
    const intMs = intervalToMs(klineInterval);
    const current = latestKlineRef.current;
    if (current) {
      const drift = exchangeNow() - closeAt;
      console.log(`[WS] ⏱ Candle close | drift: ${drift.toFixed(0)}ms | ${klineInterval}`);
      setLastKline({ ...current, isClosed: true, time: Math.floor((closeAt - intMs) / 1000) });
    }
  }, [klineInterval]);

  const scheduleCandleTimer = useCallback(() => {
    cleanupTimers();
    const intMs = intervalToMs(klineInterval);
    const closeAt = nextCandleCloseMs(intMs);
    const msUntilClose = closeAt - exchangeNow();

    if (msUntilClose <= 500) {
      pollIntervalRef.current = setInterval(() => {
        if (exchangeNow() >= closeAt) {
          clearInterval(pollIntervalRef.current!);
          fireCandleClose(closeAt);
          setTimeout(() => scheduleCandleTimer(), 100);
        }
      }, 50);
      return;
    }

    candleTimerRef.current = setTimeout(() => {
      pollIntervalRef.current = setInterval(() => {
        if (exchangeNow() >= closeAt) {
          clearInterval(pollIntervalRef.current!);
          fireCandleClose(closeAt);
          setTimeout(() => scheduleCandleTimer(), 100);
        }
      }, 50);
    }, Math.max(msUntilClose - 500, 0));
  }, [klineInterval, cleanupTimers, fireCandleClose]);

  // ── REST fallback starter ──
  const startRestFallback = useCallback((sym: string) => {
    if (usingFallback.current) return;
    usingFallback.current = true;
    console.log(`[WS] Starting REST fallback for ${sym}`);
    setConnectionStatus("fallback");

    const poll = async () => {
      const data = await fetchRestPrice(sym);
      if (data) {
        updatePrice(data.price, data.timestamp);
        setTicker(prev => ({
          price: data.price,
          priceChange: prev?.priceChange || 0,
          priceChangePercent: prev?.priceChangePercent || 0,
          high24h: prev?.high24h || data.price,
          low24h: prev?.low24h || data.price,
          volume24h: prev?.volume24h || 0,
          timestamp: data.timestamp,
        }));
      }
    };

    poll(); // Immediate first fetch
    restPollRef.current = setInterval(poll, REST_POLL_INTERVAL);
  }, [updatePrice]);

  // ── Stale detection ──
  useEffect(() => {
    if (!enabled) return;

    staleCheckerRef.current = setInterval(() => {
      const age = (Date.now() - lastTickTime.current) / 1000;
      setLastTickAge(Math.round(age));

      if (age > STALE_THRESHOLD_MS / 1000 && connectionStatus === "live") {
        setConnectionStatus("stale");
      } else if (age <= STALE_THRESHOLD_MS / 1000 && (connectionStatus === "stale")) {
        setConnectionStatus("live");
      }
    }, 1000);

    return () => {
      if (staleCheckerRef.current) clearInterval(staleCheckerRef.current);
    };
  }, [enabled, connectionStatus]);

  // ── Main WebSocket connection ──
  const connect = useCallback(async () => {
    if (!enabledRef.current) return;
    cleanupAll();

    if (!_offsetFetched) await syncServerTime();

    const sym = symbol.toLowerCase();
    const interval = klineInterval.toLowerCase();
    const streams = `${sym}@ticker/${sym}@kline_${interval}`;
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    console.log(`[WS] Connecting: ${sym} (interval: ${interval})`);
    setConnectionStatus("connecting");

    const ws = new WebSocket(url);
    wsRef.current = ws;

    // If WS doesn't open within 5s, start REST fallback
    const wsTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.warn("[WS] Connection timeout, starting REST fallback");
        startRestFallback(sym);
      }
    }, 5000);

    ws.onopen = () => {
      clearTimeout(wsTimeout);
      console.log(`[WS] Connected: ${sym}`);
      setConnected(true);
      setConnectionStatus("live");
      reconnectCount.current = 0;
      lastTickTime.current = Date.now();

      // Stop REST fallback if running
      if (restPollRef.current) {
        clearInterval(restPollRef.current);
        usingFallback.current = false;
      }

      scheduleCandleTimer();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const stream = msg.stream as string;
        const data = msg.data;

        // Binance error response (invalid symbol)
        if (data?.e === "error" || msg.error) {
          console.warn(`[WS] Binance stream error:`, data?.msg || msg.error);
          return;
        }

        if (stream?.endsWith("@ticker")) {
          const newPrice = parseFloat(data.c);
          updatePrice(newPrice, data.E);

          setTicker({
            price: newPrice,
            priceChange: parseFloat(data.p),
            priceChangePercent: parseFloat(data.P),
            high24h: parseFloat(data.h),
            low24h: parseFloat(data.l),
            volume24h: parseFloat(data.v),
            timestamp: data.E,
          });

          if (connectionStatus !== "live") setConnectionStatus("live");
        }

        if (stream?.includes("@kline_")) {
          const k = data.k;
          const kline: KlineData = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
            isClosed: k.x,
          };

          latestKlineRef.current = kline;

          if (k.x) {
            const intMs = intervalToMs(klineInterval);
            const closeAt = kline.time * 1000 + intMs;
            console.log(`[WS] ✅ Native candle close`);
            fireCandleClose(closeAt);
            scheduleCandleTimer();
          } else {
            setLastKline(kline);
          }
        }
      } catch (e) {
        console.error("[WS] Parse error:", e);
      }
    };

    ws.onerror = (err) => {
      clearTimeout(wsTimeout);
      console.error("[WS] Error:", err);
    };

    ws.onclose = (event) => {
      clearTimeout(wsTimeout);
      setConnected(false);
      cleanupTimers();

      // Code 1002/1003 or close with no prior open = invalid symbol
      if (event.code === 1002 || event.code === 1003) {
        console.warn(`[WS] Invalid stream (code ${event.code}), starting REST fallback`);
        startRestFallback(sym);
        return;
      }

      if (enabledRef.current && reconnectCount.current < MAX_RECONNECTS) {
        reconnectCount.current++;
        const delay = RECONNECT_DELAY * Math.min(reconnectCount.current, 5);
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectCount.current})`);
        setConnectionStatus("connecting");
        reconnectTimer.current = setTimeout(connect, delay);
      } else if (enabledRef.current) {
        // Max reconnects reached, fall back to REST
        console.warn("[WS] Max reconnects reached, starting REST fallback");
        startRestFallback(sym);
      }
    };
  }, [symbol, cleanupAll, klineInterval, scheduleCandleTimer, fireCandleClose, cleanupTimers, startRestFallback, updatePrice, connectionStatus]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      cleanupAll();
    }
    return cleanupAll;
  }, [enabled, connect, cleanupAll]);

  return { ticker, lastKline, connected, connectionStatus, priceDirection, prevPrice, lastTickAge };
}
