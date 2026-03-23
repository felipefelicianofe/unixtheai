import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { panicCloseAll } from "@/lib/binanceApi";

interface PanicButtonProps {
  hasPositions: boolean;
  onPanicClose: () => void;
}

export default function PanicButton({ hasPositions, onPanicClose }: PanicButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [closing, setClosing] = useState(false);

  const handleConfirm = async () => {
    setClosing(true);
    try {
      const result = await panicCloseAll();
      toast.success(`Todas as posições encerradas! ${result?.closed || 0} posição(ões) fechada(s).`);
      onPanicClose();
    } catch (err) {
      toast.error(`Erro ao encerrar: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setClosing(false);
      setShowModal(false);
    }
  };

  return (
    <>
      <motion.div
        className="fixed bottom-8 right-8 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
      >
        <motion.button
          onClick={() => hasPositions && setShowModal(true)}
          disabled={!hasPositions}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`relative px-6 py-4 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all ${
            hasPositions
              ? "bg-[hsl(var(--neon-red))] text-white shadow-[0_0_30px_hsl(var(--neon-red)/0.4),0_0_60px_hsl(var(--neon-red)/0.15)] hover:shadow-[0_0_40px_hsl(var(--neon-red)/0.5),0_0_80px_hsl(var(--neon-red)/0.2)]"
              : "bg-muted/30 text-muted-foreground cursor-not-allowed"
          }`}
        >
          {hasPositions && (
            <motion.div
              className="absolute inset-0 rounded-2xl bg-[hsl(var(--neon-red))]"
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            🚨 PANIC CLOSE ALL
          </span>
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => !closing && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-2xl p-8 max-w-md w-full mx-4 border border-[hsl(var(--neon-red))]/30 shadow-[0_0_40px_hsl(var(--neon-red)/0.15)]"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-[hsl(var(--neon-red))]/15 border border-[hsl(var(--neon-red))]/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-[hsl(var(--neon-red))]" />
                </div>
                <button onClick={() => !closing && setShowModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h3 className="text-xl font-bold text-foreground mb-2">Encerramento de Emergência</h3>
              <p className="text-muted-foreground text-sm mb-2">
                Deseja encerrar <span className="text-[hsl(var(--neon-red))] font-semibold">todas as posições</span> a mercado imediatamente?
              </p>
              <p className="text-xs text-destructive/80 mb-6">
                ⚠️ Ordens reais serão enviadas à Binance Futures. Esta ação não pode ser desfeita.
              </p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowModal(false)} disabled={closing} className="flex-1 border-border/50">
                  Cancelar
                </Button>
                <Button onClick={handleConfirm} disabled={closing} className="flex-1 bg-[hsl(var(--neon-red))] hover:bg-[hsl(var(--neon-red))]/90 text-white font-bold gap-2">
                  {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {closing ? "Encerrando..." : "Sim, Encerrar Tudo"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
