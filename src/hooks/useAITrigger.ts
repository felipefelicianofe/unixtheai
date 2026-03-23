import { useRef, useCallback, useState } from "react";
import type { KlineData, TickerData } from "./useBinanceSocket";

export type TriggerReason = "candle_close" | "volume_anomaly" | "structure_break" | "manual";

interface TriggerState {
  triggered: boolean;
  reason: TriggerReason | null;
  message: string | null;
  cooldownActive: boolean;
}

interface UseAITriggerOptions {
  onTrigger: (reason: TriggerReason) => void;
  cooldownMs?: number;
  orderBlockZones?: Array<{ low: number; high: number }>;
  resistanceLevels?: number[];
}

export function useAITrigger({
  onTrigger,
  cooldownMs = 60000,
  orderBlockZones = [],
  resistanceLevels = [],
}: UseAITriggerOptions) {
  const [state, setState] = useState<TriggerState>({
    triggered: false,
    reason: null,
    message: null,
    cooldownActive: false,
  });

  const lastTriggerTime = useRef(0);
  const volumeHistory = useRef<number[]>([]);
  const lastCandleTime = useRef(0);
  const lastStructurePrice = useRef(0);
  // Dedup: track the last candle close time we already fired for
  const firedCandleCloseTime = useRef(0);

  const fire = useCallback(
    (reason: TriggerReason, message: string) => {
      const now = Date.now();
      if (now - lastTriggerTime.current < cooldownMs) {
        setState((s) => ({ ...s, cooldownActive: true }));
        return;
      }
      lastTriggerTime.current = now;
      setState({
        triggered: true,
        reason,
        message,
        cooldownActive: false,
      });
      onTrigger(reason);
      setTimeout(() => setState((s) => ({ ...s, triggered: false, message: null })), 5000);
    },
    [onTrigger, cooldownMs]
  );

  const processKline = useCallback(
    (kline: KlineData) => {
      // TRIGGER 1: Candle close (from timer OR native k.x)
      // Deduplicate: only fire once per unique candle time
      if (kline.isClosed && kline.time !== firedCandleCloseTime.current) {
        firedCandleCloseTime.current = kline.time;
        lastCandleTime.current = kline.time;
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
        fire("candle_close", `Candle fechou às ${timeStr}. Recalculando tese...`);
      }

      // TRIGGER 2: Volume anomaly (>300% of 20-period MA)
      if (!kline.isClosed) {
        volumeHistory.current.push(kline.volume);
        if (volumeHistory.current.length > 60) volumeHistory.current.shift();
        if (volumeHistory.current.length >= 20) {
          const avg =
            volumeHistory.current.slice(-20).reduce((a, b) => a + b, 0) / 20;
          if (kline.volume > avg * 3) {
            fire(
              "volume_anomaly",
              `🚨 Volume Anomalia: ${(kline.volume / avg).toFixed(1)}x a média. Smart Money detectado.`
            );
          }
        }
      }
    },
    [fire]
  );

  const processTicker = useCallback(
    (ticker: TickerData) => {
      const price = ticker.price;

      for (const zone of orderBlockZones) {
        if (
          (lastStructurePrice.current < zone.low && price >= zone.low) ||
          (lastStructurePrice.current > zone.high && price <= zone.high)
        ) {
          fire(
            "structure_break",
            `🚨 Quebra de estrutura: Preço entrou no Order Block ${zone.low.toFixed(0)}-${zone.high.toFixed(0)}`
          );
          break;
        }
      }

      for (const level of resistanceLevels) {
        const threshold = level * 0.001;
        if (
          (lastStructurePrice.current < level - threshold && price >= level - threshold) ||
          (lastStructurePrice.current > level + threshold && price <= level + threshold)
        ) {
          fire(
            "structure_break",
            `🚨 Preço cruzou nível chave: $${level.toFixed(0)}`
          );
          break;
        }
      }

      lastStructurePrice.current = price;
    },
    [fire, orderBlockZones, resistanceLevels]
  );

  const reset = useCallback(() => {
    setState({ triggered: false, reason: null, message: null, cooldownActive: false });
  }, []);

  return { state, processKline, processTicker, reset };
}
