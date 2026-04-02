import { useState, useCallback, useRef, useEffect } from "react";
import { useBinanceSocket, toBinanceSymbol } from "./useBinanceSocket";
import type { TickerData } from "./useBinanceSocket";
import { fetchRealPositions } from "@/lib/binanceApi";
import { supabase } from "@/integrations/supabase/client";
import type { Position } from "@/lib/tradingEngine";

export interface AISignal {
  direction: "LONG" | "SHORT" | "NEUTRAL";
  confidence: number;
  reason: string;
  indicators: string[];
  loading: boolean;
  lastUpdate: number | null;
}

interface UseLiveTradeEngineOptions {
  selectedAsset: string;
  isConnected: boolean;
}

export function useLiveTradeEngine({ selectedAsset, isConnected }: UseLiveTradeEngineOptions) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [aiSignal, setAiSignal] = useState<AISignal>({
    direction: "NEUTRAL",
    confidence: 0,
    reason: "Aguardando análise...",
    indicators: [],
    loading: false,
    lastUpdate: null,
  });

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

  // AI Analysis
  const fetchAISignal = useCallback(async () => {
    if (!selectedAsset) return;
    setAiSignal((prev) => ({ ...prev, loading: true }));
    try {
      const { data, error } = await supabase.functions.invoke("analyze-asset", {
        body: { asset: selectedAsset, timeframe: "15m" },
      });
      if (error) throw error;

      const result = data?.result || data;
      setAiSignal({
        direction: result?.direction || "NEUTRAL",
        confidence: result?.confidence || 0,
        reason: result?.summary || result?.reason || "Análise concluída",
        indicators: result?.indicators || [],
        loading: false,
        lastUpdate: Date.now(),
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
