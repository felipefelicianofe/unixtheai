import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { closePosition } from "@/lib/binanceApi";
import type { Position } from "@/lib/tradingEngine";

interface Props {
  positions: Position[];
  isConnected: boolean;
  onPositionClosed: () => void;
}

export default function LivePositionsPanel({ positions, isConnected, onPositionClosed }: Props) {
  const [closingId, setClosingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const handleClose = async (pos: Position) => {
    setClosingId(pos.id);
    try {
      await closePosition(pos.symbol, pos.side, pos.size);
      toast.success(`Posição ${pos.symbol} fechada`);
      onPositionClosed();
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : "Falha"}`);
    } finally {
      setClosingId(null);
    }
  };

  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="glass-card rounded-2xl p-5 border border-border/20"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full mb-2"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[hsl(var(--neon-green))]/10 border border-[hsl(var(--neon-green))]/20 flex items-center justify-center">
            <Activity className="w-4 h-4 text-[hsl(var(--neon-green))]" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-foreground">
              Posições Abertas
              {positions.length > 0 && (
                <span className="ml-2 text-xs font-mono text-muted-foreground">({positions.length})</span>
              )}
            </h3>
            {!expanded && positions.length > 0 && (
              <div className="flex items-center gap-3 text-xs mt-0.5">
                {positions.slice(0, 3).map((p) => (
                  <span key={p.id} className="font-mono">
                    <span className="text-foreground">{p.symbol}</span>
                    <span className={p.pnl >= 0 ? "text-[hsl(var(--neon-green))] ml-1" : "text-[hsl(var(--neon-red))] ml-1"}>
                      {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(2)}
                    </span>
                  </span>
                ))}
                <span className={`font-bold ${totalPnl >= 0 ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"}`}>
                  Total: {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {positions.length > 0 && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--neon-green))] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--neon-green))]" />
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
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
            {!isConnected ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Conecte sua corretora para ver posições</p>
            ) : positions.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Nenhuma posição aberta</p>
            ) : (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border/30">
                      {["Ativo", "Lado", "Tamanho", "Entrada", "Atual", "PnL", "ROE %", ""].map((h) => (
                        <th key={h} className="text-[10px] text-muted-foreground font-medium pb-2 pr-3 whitespace-nowrap uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((pos) => (
                      <tr key={pos.id} className="border-b border-border/10 hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 pr-3">
                          <span className="text-xs font-bold text-foreground">{pos.symbol}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">{pos.leverage}x</span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            pos.side === "LONG"
                              ? "bg-[hsl(var(--neon-green))]/15 text-[hsl(var(--neon-green))]"
                              : "bg-[hsl(var(--neon-red))]/15 text-[hsl(var(--neon-red))]"
                          }`}>
                            {pos.side}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-foreground">{pos.size}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">${pos.entryPrice.toLocaleString()}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-foreground">${pos.currentPrice.toLocaleString()}</td>
                        <td className="py-2.5 pr-3">
                          <span className={`font-mono text-xs font-bold ${pos.pnl >= 0 ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"}`}>
                            {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={`font-mono text-xs font-bold ${pos.roe >= 0 ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"}`}>
                            {pos.roe >= 0 ? "+" : ""}{pos.roe.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleClose(pos)}
                            disabled={closingId === pos.id}
                            className="h-6 w-6 text-muted-foreground hover:text-[hsl(var(--neon-red))] hover:bg-[hsl(var(--neon-red))]/10"
                          >
                            {closingId === pos.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
