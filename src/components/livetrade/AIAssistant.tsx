import { memo } from "react";
import { motion } from "framer-motion";
import { Brain, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AISignal } from "@/hooks/useLiveTradeEngine";

interface Props {
  aiSignal: AISignal;
  onRefresh: () => void;
  asset: string;
}

const AIAssistant = memo(({ aiSignal, onRefresh, asset }: Props) => {
  const directionIcon = {
    LONG: <TrendingUp className="w-5 h-5" />,
    SHORT: <TrendingDown className="w-5 h-5" />,
    NEUTRAL: <Minus className="w-5 h-5" />,
  };

  const directionColor = {
    LONG: "text-[hsl(var(--neon-green))]",
    SHORT: "text-[hsl(var(--neon-red))]",
    NEUTRAL: "text-muted-foreground",
  };

  const directionBg = {
    LONG: "bg-[hsl(var(--neon-green))]/10 border-[hsl(var(--neon-green))]/20",
    SHORT: "bg-[hsl(var(--neon-red))]/10 border-[hsl(var(--neon-red))]/20",
    NEUTRAL: "bg-muted/30 border-border/30",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass-card rounded-2xl p-5 border border-border/20"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center">
            <Brain className="w-4 h-4 text-secondary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">IA Assistant</h3>
            <p className="text-[10px] text-muted-foreground">
              Análise em tempo real • {asset}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={aiSignal.loading}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          {aiSignal.loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* Direction Badge */}
      <div className={`p-4 rounded-xl border mb-4 ${directionBg[aiSignal.direction]}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${directionBg[aiSignal.direction]} ${directionColor[aiSignal.direction]}`}>
            {directionIcon[aiSignal.direction]}
          </div>
          <div>
            <div className={`text-lg font-black ${directionColor[aiSignal.direction]}`}>
              {aiSignal.direction}
            </div>
            <div className="text-xs text-muted-foreground">
              Confiança: <span className="font-mono font-bold text-foreground">{aiSignal.confidence.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Confidence Bar */}
      <div className="mb-4">
        <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${aiSignal.confidence}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full ${
              aiSignal.confidence >= 70
                ? "bg-[hsl(var(--neon-green))]"
                : aiSignal.confidence >= 45
                ? "bg-primary"
                : "bg-muted-foreground"
            }`}
          />
        </div>
      </div>

      {/* Reason */}
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{aiSignal.reason}</p>

      {/* Indicators */}
      {aiSignal.indicators.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {aiSignal.indicators.slice(0, 6).map((ind, i) => (
            <span
              key={i}
              className="text-[9px] px-2 py-1 rounded-md bg-muted/30 text-muted-foreground border border-border/20 font-mono"
            >
              {ind}
            </span>
          ))}
        </div>
      )}

      {/* Last Update */}
      {aiSignal.lastUpdate && (
        <p className="text-[9px] text-muted-foreground/60 mt-3">
          Última atualização: {new Date(aiSignal.lastUpdate).toLocaleTimeString()}
        </p>
      )}
    </motion.div>
  );
});

AIAssistant.displayName = "AIAssistant";
export default AIAssistant;
