import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Lock, TrendingDown, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

interface DailyProfitLockProps {
  currentPnl: number;
}

export default function DailyProfitLock({ currentPnl }: DailyProfitLockProps) {
  const [profitGoal, setProfitGoal] = useState(120);
  const [maxDrawdown, setMaxDrawdown] = useState(80);
  const [locked, setLocked] = useState(false);
  const [lockReason, setLockReason] = useState<"profit" | "loss" | null>(null);

  const profitProgress = Math.max(0, Math.min((currentPnl / profitGoal) * 100, 100));
  const drawdownProgress = currentPnl < 0 ? Math.min((Math.abs(currentPnl) / maxDrawdown) * 100, 100) : 0;

  useEffect(() => {
    if (currentPnl >= profitGoal && !locked) {
      setLocked(true);
      setLockReason("profit");
    } else if (currentPnl <= -maxDrawdown && !locked) {
      setLocked(true);
      setLockReason("loss");
    }
  }, [currentPnl, profitGoal, maxDrawdown, locked]);

  const handleUnlock = () => {
    setLocked(false);
    setLockReason(null);
  };

  return (
    <>
      <div className="space-y-4 mt-4 pt-4 border-t border-border/20">
        {/* Section Title */}
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold text-foreground">Trava de Ganância (Kill Switch)</span>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Meta de Lucro ($)</label>
            <div className="relative">
              <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--neon-green))]/60" />
              <Input
                type="number"
                value={profitGoal}
                onChange={(e) => setProfitGoal(Number(e.target.value) || 0)}
                className="bg-background/50 border-border/50 font-mono text-sm pl-7 h-9"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Limite de Perda ($)</label>
            <div className="relative">
              <TrendingDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--neon-red))]/60" />
              <Input
                type="number"
                value={maxDrawdown}
                onChange={(e) => setMaxDrawdown(Number(e.target.value) || 0)}
                className="bg-background/50 border-border/50 font-mono text-sm pl-7 h-9"
              />
            </div>
          </div>
        </div>

        {/* Profit Progress */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground">Progresso da Meta</span>
            <span className="text-xs font-mono font-bold text-foreground">
              <span className={currentPnl >= 0 ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"}>
                {currentPnl >= 0 ? "+" : ""}${currentPnl.toFixed(2)}
              </span>
              <span className="text-muted-foreground"> / ${profitGoal.toFixed(2)}</span>
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-background/50 overflow-hidden relative">
            <motion.div
              className="h-full rounded-full"
              style={{
                width: `${profitProgress}%`,
                background: profitProgress >= 100
                  ? "linear-gradient(90deg, hsl(var(--neon-green)), hsl(50 100% 50%))"
                  : `hsl(var(--neon-green))`,
                boxShadow: profitProgress > 50 ? "0 0 12px hsl(var(--neon-green) / 0.5)" : "none",
              }}
              initial={{ width: 0 }}
              animate={{ width: `${profitProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Drawdown Progress (only if negative) */}
        {currentPnl < 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground">Drawdown</span>
              <span className="text-xs font-mono font-bold text-[hsl(var(--neon-red))]">
                ${Math.abs(currentPnl).toFixed(2)} / ${maxDrawdown.toFixed(2)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-background/50 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[hsl(var(--neon-red))]"
                style={{ boxShadow: drawdownProgress > 70 ? "0 0 12px hsl(var(--neon-red) / 0.5)" : "none" }}
                initial={{ width: 0 }}
                animate={{ width: `${drawdownProgress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Full Screen Lock Overlay */}
      <AnimatePresence>
        {locked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 backdrop-blur-lg"
          >
            {/* Confetti / Success particles for profit goal */}
            {lockReason === "profit" && (
              <>
                {Array.from({ length: 20 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      background: ["hsl(var(--neon-green))", "hsl(50 100% 50%)", "hsl(var(--primary))"][i % 3],
                      left: `${10 + Math.random() * 80}%`,
                      top: `${Math.random() * 40}%`,
                    }}
                    initial={{ y: -100, opacity: 1, scale: 0 }}
                    animate={{
                      y: [0, 300 + Math.random() * 400],
                      opacity: [1, 0],
                      scale: [0, 1.5, 0.5],
                      x: [(Math.random() - 0.5) * 200],
                    }}
                    transition={{
                      duration: 2 + Math.random() * 2,
                      delay: Math.random() * 0.5,
                      repeat: Infinity,
                      repeatDelay: Math.random() * 3,
                    }}
                  />
                ))}
              </>
            )}

            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200 }}
              className={`glass-strong rounded-3xl p-10 max-w-lg w-full mx-4 text-center border ${
                lockReason === "profit"
                  ? "border-[hsl(var(--neon-green))]/30 shadow-[0_0_60px_hsl(var(--neon-green)/0.1)]"
                  : "border-[hsl(var(--neon-red))]/30 shadow-[0_0_60px_hsl(var(--neon-red)/0.1)]"
              }`}
            >
              {lockReason === "profit" ? (
                <>
                  <motion.div
                    animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[hsl(var(--neon-green))]/20 to-yellow-500/20 border border-[hsl(var(--neon-green))]/30 flex items-center justify-center"
                  >
                    <Trophy className="w-10 h-10 text-yellow-400" />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    🎉 Meta Diária Atingida!
                  </h2>
                  <p className="text-3xl font-bold font-mono text-[hsl(var(--neon-green))] mb-4">
                    +${currentPnl.toFixed(2)}
                  </p>
                  <p className="text-muted-foreground text-sm mb-8 max-w-sm mx-auto">
                    Seu capital foi protegido e o robô foi pausado automaticamente. 
                    Vá aproveitar o seu dia. O mercado estará aqui amanhã.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[hsl(var(--neon-red))]/10 border border-[hsl(var(--neon-red))]/30 flex items-center justify-center">
                    <Lock className="w-10 h-10 text-[hsl(var(--neon-red))]" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Limite de Perda Atingido
                  </h2>
                  <p className="text-3xl font-bold font-mono text-[hsl(var(--neon-red))] mb-4">
                    -${Math.abs(currentPnl).toFixed(2)}
                  </p>
                  <p className="text-muted-foreground text-sm mb-8 max-w-sm mx-auto">
                    O robô foi pausado para proteger seu capital. 
                    Respire, analise, e volte amanhã com a mente limpa.
                  </p>
                </>
              )}

              <button
                onClick={handleUnlock}
                className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
              >
                Resetar para próximo dia (demo)
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
