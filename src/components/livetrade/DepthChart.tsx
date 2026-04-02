import { memo, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { Layers } from "lucide-react";
import type { OrderBookData } from "@/hooks/useOrderBook";

interface Props {
  orderBook: OrderBookData | null;
  connected: boolean;
}

const DepthChart = memo(({ orderBook, connected }: Props) => {
  const chartData = useMemo(() => {
    if (!orderBook) return [];

    const bidsData = [...orderBook.bids]
      .reverse()
      .map((b) => ({
        price: b.price,
        bids: b.total,
        asks: 0,
      }));

    const asksData = orderBook.asks.map((a) => ({
      price: a.price,
      bids: 0,
      asks: a.total,
    }));

    return [...bidsData, ...asksData];
  }, [orderBook]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card rounded-2xl p-5 border border-border/20"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Profundidade de Mercado</h3>
            <p className="text-[10px] text-muted-foreground">
              {connected ? "Atualização em tempo real" : "Desconectado"}
              {orderBook && ` • Spread: $${orderBook.spread.toFixed(2)} (${orderBook.spreadPct.toFixed(4)}%)`}
            </p>
          </div>
        </div>
        <div className={`w-2 h-2 rounded-full ${connected ? "bg-[hsl(var(--neon-green))] animate-pulse" : "bg-muted-foreground"}`} />
      </div>

      {chartData.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
          Aguardando dados do book...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="bidGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(142, 76%, 50%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(142, 76%, 50%)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="askGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="price"
              tick={{ fontSize: 9, fill: "hsl(215, 20%, 55%)" }}
              tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: "hsl(222, 47%, 8%)",
                border: "1px solid hsl(217, 33%, 18%)",
                borderRadius: "8px",
                fontSize: "11px",
              }}
              formatter={(value: number, name: string) => [
                value.toFixed(4),
                name === "bids" ? "Compras" : "Vendas",
              ]}
              labelFormatter={(label) => `$${Number(label).toLocaleString()}`}
            />
            <Area type="stepAfter" dataKey="bids" stroke="hsl(142, 76%, 50%)" fill="url(#bidGrad)" strokeWidth={1.5} />
            <Area type="stepAfter" dataKey="asks" stroke="hsl(0, 84%, 60%)" fill="url(#askGrad)" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
});

DepthChart.displayName = "DepthChart";
export default DepthChart;
