import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, X, Lock, Radar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Position } from "@/lib/tradingEngine";
import { fetchRealPositions, closePosition } from "@/lib/binanceApi";

function PriceCell({ price, prevPrice }: { price: number; prevPrice?: number }) {
  const [flash, setFlash] = useState<"green" | "red" | null>(null);

  useEffect(() => {
    if (prevPrice === undefined) return;
    if (price > prevPrice) setFlash("green");
    else if (price < prevPrice) setFlash("red");
    const t = setTimeout(() => setFlash(null), 400);
    return () => clearTimeout(t);
  }, [price, prevPrice]);

  return (
    <span
      className={`font-mono text-sm transition-colors duration-300 ${
        flash === "green"
          ? "text-[hsl(var(--neon-green))]"
          : flash === "red"
          ? "text-[hsl(var(--neon-red))]"
          : "text-foreground"
      }`}
    >
      ${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

function RadarAnimation() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative w-20 h-20">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border border-primary/30"
            initial={{ scale: 0.5, opacity: 0.8 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
          />
        ))}
        <div className="absolute inset-0 flex items-center justify-center">
          <Radar className="w-8 h-8 text-primary" />
        </div>
      </div>
      <p className="text-muted-foreground text-sm text-center max-w-xs">
        A IA está analisando o mercado. Nenhuma operação aberta no momento.
      </p>
    </div>
  );
}

interface LivePositionsProps {
  isConnected?: boolean;
  onPositionsChange?: (hasPositions: boolean) => void;
}

export default function LivePositions({ isConnected = false, onPositionsChange }: LivePositionsProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  // Fetch real positions when connected
  const fetchPositions = useCallback(async () => {
    if (!isConnected) return;
    try {
      const realPositions = await fetchRealPositions();
      setPositions(realPositions);
      onPositionsChange?.(realPositions.length > 0);
    } catch (err) {
      console.error("Failed to fetch positions:", err);
    }
  }, [isConnected, onPositionsChange]);

  useEffect(() => {
    if (!isConnected) {
      setPositions([]);
      onPositionsChange?.(false);
      return;
    }

    setLoading(true);
    fetchPositions().finally(() => setLoading(false));

    // Poll positions every 5 seconds
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, [isConnected, fetchPositions, onPositionsChange]);

  const handleClose = async (pos: Position) => {
    setClosingId(pos.id);
    try {
      await closePosition(pos.symbol, pos.side, pos.size);
      toast.success(`Posição ${pos.symbol} fechada com sucesso`);
      await fetchPositions();
    } catch (err) {
      toast.error(`Erro ao fechar posição: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setClosingId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass rounded-2xl p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[hsl(var(--neon-green))]/10 border border-[hsl(var(--neon-green))]/20 flex items-center justify-center">
          <Activity className="w-5 h-5 text-[hsl(var(--neon-green))]" />
        </div>
        <div>
          <h3 className="text-foreground font-semibold text-lg">Operações em Andamento</h3>
          <p className="text-muted-foreground text-xs">
            {!isConnected
              ? "Conecte sua corretora para ver posições reais"
              : positions.length > 0
              ? `${positions.length} posição(ões) ativa(s) — Dados reais`
              : "Aguardando sinais da IA"}
          </p>
        </div>
        {positions.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--neon-green))] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--neon-green))]" />
            </span>
            <span className="text-xs text-[hsl(var(--neon-green))]">LIVE</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : positions.length === 0 ? (
        <RadarAnimation />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border/30">
                {["Ativo", "Lado", "Tamanho", "Entrada", "Preço Atual", "PnL ($)", "ROE %", "Liquidação", ""].map((h) => (
                  <th key={h} className="text-xs text-muted-foreground font-medium pb-3 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {positions.map((pos) => (
                  <motion.tr
                    key={pos.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border-b border-border/10 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <span className="text-sm font-semibold text-foreground">{pos.symbol}</span>
                      <span className="text-xs text-muted-foreground ml-1">{pos.leverage}x</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        pos.side === "LONG"
                          ? "bg-[hsl(var(--neon-green))]/15 text-[hsl(var(--neon-green))]"
                          : "bg-[hsl(var(--neon-red))]/15 text-[hsl(var(--neon-red))]"
                      }`}>
                        {pos.side === "LONG" ? "🟩 LONG" : "🟥 SHORT"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-sm text-foreground">{pos.size}</td>
                    <td className="py-3 pr-4 font-mono text-sm text-muted-foreground">
                      ${pos.entryPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 pr-4">
                      <PriceCell price={pos.currentPrice} prevPrice={pos.entryPrice} />
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`font-mono text-sm font-bold ${pos.pnl >= 0 ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"}`}>
                        {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`font-mono text-sm font-bold ${pos.roe >= 0 ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"}`}>
                        {pos.roe >= 0 ? "+" : ""}{pos.roe.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="font-mono text-sm text-muted-foreground">
                        {(pos as Position & { liquidationPrice?: number }).liquidationPrice
                          ? `$${((pos as Position & { liquidationPrice?: number }).liquidationPrice!).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </span>
                    </td>
                    <td className="py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleClose(pos)}
                        disabled={closingId === pos.id}
                        className="h-7 w-7 text-muted-foreground hover:text-[hsl(var(--neon-red))] hover:bg-[hsl(var(--neon-red))]/10"
                      >
                        {closingId === pos.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      </Button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
