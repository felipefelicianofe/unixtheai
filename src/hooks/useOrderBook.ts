import { useEffect, useRef, useState, useCallback } from "react";

export interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
}

export interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
  spreadPct: number;
  lastUpdateId: number;
}

interface UseOrderBookOptions {
  symbol: string;
  enabled?: boolean;
  depth?: number;
}

export function useOrderBook({ symbol, enabled = true, depth = 20 }: UseOrderBookOptions) {
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();

  const cleanup = useCallback(() => {
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !symbol) return;
    cleanup();

    const sym = symbol.toLowerCase();
    const url = `wss://stream.binance.com:9443/ws/${sym}@depth${depth}@100ms`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const bids: OrderBookEntry[] = [];
        const asks: OrderBookEntry[] = [];
        let bidTotal = 0;
        let askTotal = 0;

        for (const [p, q] of data.bids || []) {
          bidTotal += parseFloat(q);
          bids.push({ price: parseFloat(p), quantity: parseFloat(q), total: bidTotal });
        }

        for (const [p, q] of data.asks || []) {
          askTotal += parseFloat(q);
          asks.push({ price: parseFloat(p), quantity: parseFloat(q), total: askTotal });
        }

        const bestBid = bids[0]?.price || 0;
        const bestAsk = asks[0]?.price || 0;
        const spread = bestAsk - bestBid;
        const spreadPct = bestBid > 0 ? (spread / bestBid) * 100 : 0;

        setOrderBook({
          bids,
          asks,
          spread,
          spreadPct,
          lastUpdateId: data.lastUpdateId || Date.now(),
        });
      } catch (e) {
        console.error("[OrderBook] Parse error:", e);
      }
    };

    ws.onerror = () => console.error("[OrderBook] WS error");

    ws.onclose = () => {
      setConnected(false);
      if (enabled) {
        reconnectRef.current = setTimeout(connect, 3000);
      }
    };
  }, [symbol, enabled, depth, cleanup]);

  useEffect(() => {
    if (enabled) connect();
    else cleanup();
    return cleanup;
  }, [enabled, connect, cleanup]);

  return { orderBook, connected };
}
