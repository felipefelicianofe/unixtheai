import { useEffect, useRef, memo } from "react";
import { createChart, type IChartApi, CandlestickSeries, HistogramSeries, ColorType, LineStyle, type CandlestickData, type HistogramData, type Time } from "lightweight-charts";

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Props {
  candles: CandleData[];
  entryPrice?: number;
  stopLoss?: number;
  takeProfit1?: number;
  takeProfit2?: number;
  takeProfit3?: number;
  signal?: string;
  hasRealVolume?: boolean;
  timeframe?: string;
}

const TradingChart = memo(({ candles, entryPrice, stopLoss, takeProfit1, takeProfit2, takeProfit3, hasRealVolume, timeframe }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "hsl(215, 20%, 55%)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "hsl(217, 33%, 12%)" },
        horzLines: { color: "hsl(217, 33%, 12%)" },
      },
      crosshair: {
        vertLine: { color: "hsl(217, 91%, 60%)", width: 1, style: LineStyle.Dashed },
        horzLine: { color: "hsl(217, 91%, 60%)", width: 1, style: LineStyle.Dashed },
      },
      timeScale: { borderColor: "hsl(217, 33%, 18%)", timeVisible: true },
      rightPriceScale: { borderColor: "hsl(217, 33%, 18%)" },
      width: containerRef.current.clientWidth,
      height: 400,
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "hsl(142, 76%, 50%)",
      downColor: "hsl(0, 84%, 60%)",
      borderDownColor: "hsl(0, 84%, 60%)",
      borderUpColor: "hsl(142, 76%, 50%)",
      wickDownColor: "hsl(0, 84%, 45%)",
      wickUpColor: "hsl(142, 76%, 40%)",
    });

    const sorted = [...candles].sort((a, b) => a.time - b.time);
    candleSeries.setData(sorted as unknown as CandlestickData[]);

    // Price lines
    const lines: Array<{ price: number; color: string; style: import("lightweight-charts").LineStyle; title: string; width: number }> = [];
    if (entryPrice) lines.push({ price: entryPrice, color: "hsl(217, 91%, 60%)", style: LineStyle.Solid, title: "Entry", width: 2 });
    if (stopLoss) lines.push({ price: stopLoss, color: "hsl(0, 84%, 60%)", style: LineStyle.Dashed, title: "Stop Loss", width: 2 });
    if (takeProfit1) lines.push({ price: takeProfit1, color: "hsl(142, 76%, 50%)", style: LineStyle.Dashed, title: "TP1", width: 1 });
    if (takeProfit2) lines.push({ price: takeProfit2, color: "hsl(142, 76%, 50%)", style: LineStyle.Dashed, title: "TP2", width: 1 });
    if (takeProfit3) lines.push({ price: takeProfit3, color: "hsl(142, 76%, 50%)", style: LineStyle.Solid, title: "TP3", width: 2 });

    lines.forEach((l) => {
      candleSeries.createPriceLine({
        price: l.price,
        color: l.color,
        lineWidth: l.width as Exclude<import("lightweight-charts").LineWidth, undefined>,
        lineStyle: l.style,
        axisLabelVisible: true,
        title: l.title,
      });
    });

    // Volume — ONLY show when we have real volume data
    if (hasRealVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });

      const volumeData = sorted
        .filter(c => c.volume && c.volume > 0)
        .map((c) => ({
          time: c.time,
          value: c.volume!,
          color: c.close >= c.open ? "hsla(142, 76%, 50%, 0.3)" : "hsla(0, 84%, 60%, 0.3)",
        }));
      if (volumeData.length > 0) {
        volumeSeries.setData(volumeData as unknown as HistogramData[]);
      }
    }

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, entryPrice, stopLoss, takeProfit1, takeProfit2, takeProfit3, hasRealVolume, timeframe]);

  return (
    <div className="glass rounded-2xl p-4 neon-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-foreground text-sm">Gráfico Interativo {timeframe && <span className="text-primary ml-1">· {timeframe}</span>}</h3>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-primary inline-block" /> Entry</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[hsl(0,84%,60%)] inline-block" /> Stop Loss</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[hsl(142,76%,50%)] inline-block" /> Take Profit</span>
          {hasRealVolume === false && (
            <span className="text-muted-foreground/60 italic">Volume indisponível</span>
          )}
        </div>
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
});

TradingChart.displayName = "TradingChart";

export default TradingChart;
