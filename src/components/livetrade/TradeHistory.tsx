import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TradeRecord {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  pnl: number | null;
  created_at: string;
}

export default function TradeHistory() {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTrades = async () => {
      setLoading(true);
      try {
        // Fetch today's trades from the analyses table as a proxy
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data } = await supabase
          .from("analysis_history")
          .select("id, asset, signal, final_confidence_pct, created_at, entry_price")
          .gte("created_at", today.toISOString())
          .order("created_at", { ascending: false })
          .limit(50);

        if (data) {
          const mapped: TradeRecord[] = data.map((d) => ({
            id: d.id,
            symbol: d.asset,
            side: d.signal === "Compra" ? "BUY" as const : "SELL" as const,
            quantity: 0,
            price: d.entry_price || 0,
            pnl: null,
            created_at: d.created_at,
          }));
          setTrades(mapped);
        }
      } catch (err) {
        console.error("[TradeHistory] Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();
    const interval = setInterval(fetchTrades, 30_000);
    return () => clearInterval(interval);
  }, []);

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const wins = trades.filter((t) => t.pnl !== null && t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl !== null && t.pnl < 0).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="glass-card rounded-2xl p-5 border border-border/20"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-foreground">
              Histórico do Dia
              <span className="ml-2 text-xs font-mono text-muted-foreground">({trades.length} sinais)</span>
            </h3>
            <div className="flex items-center gap-3 text-[10px] mt-0.5">
              {wins > 0 && <span className="text-[hsl(var(--neon-green))] font-mono">{wins}W</span>}
              {losses > 0 && <span className="text-[hsl(var(--neon-red))] font-mono">{losses}L</span>}
              {totalPnl !== 0 && (
                <span className={`font-mono font-bold ${totalPnl >= 0 ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"}`}>
                  P&L: {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {loading ? (
              <p className="text-xs text-muted-foreground py-6 text-center animate-pulse">Carregando...</p>
            ) : trades.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhum sinal registrado hoje</p>
            ) : (
              <div className="mt-4 space-y-1.5 max-h-[300px] overflow-y-auto">
                {trades.map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {trade.side === "BUY" ? (
                        <TrendingUp className="w-3.5 h-3.5 text-[hsl(var(--neon-green))]" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-[hsl(var(--neon-red))]" />
                      )}
                      <span className="text-xs font-bold text-foreground">{trade.symbol}</span>
                      <span className={`text-[9px] font-bold ${trade.side === "BUY" ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"}`}>
                        {trade.side}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {trade.pnl !== null && (
                        <span className={`text-xs font-mono font-bold ${trade.pnl >= 0 ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"}`}>
                          {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                        </span>
                      )}
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {new Date(trade.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
