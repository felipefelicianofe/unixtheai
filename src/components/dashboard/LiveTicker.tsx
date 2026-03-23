import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, TrendingUp, TrendingDown } from "lucide-react";
import type { TickerData } from "@/hooks/useBinanceSocket";

interface Props {
  ticker: TickerData | null;
  connected: boolean;
  priceDirection: "up" | "down" | null;
  asset: string;
}

const LiveTicker = memo(({ ticker, connected, priceDirection, asset }: Props) => {
  if (!ticker) {
    return (
      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
        <span className="text-sm text-muted-foreground">Conectando ao feed de {asset}...</span>
      </div>
    );
  }

  const isPositive = ticker.priceChangePercent >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card rounded-2xl p-4 border border-white/5 relative overflow-hidden group shadow-2xl"
    >
      {/* Background Pulse Effect */}
      <AnimatePresence>
        {priceDirection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.08 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 z-0 ${
              priceDirection === "up" ? "bg-[hsl(var(--neon-green))]" : "bg-[hsl(var(--neon-red))]"
            }`}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between flex-wrap gap-3 relative z-10">
        {/* Live Price Section */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-0.5">
              <div className={`relative flex items-center justify-center`}>
                {connected && (
                  <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute w-2 h-2 rounded-full bg-[hsl(var(--neon-green))]" 
                  />
                )}
                <div className={`w-2 h-2 rounded-full ${connected ? "bg-[hsl(var(--neon-green))]" : "bg-[hsl(var(--neon-red))]"}`} />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                {asset.split('/')[0]} <span className="opacity-40">{connected ? "LIVE" : "DISCONNECTED"}</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={ticker.price}
                  initial={{ y: priceDirection === "up" ? 10 : -10, opacity: 0 }}
                  animate={{ 
                    y: 0, 
                    opacity: 1,
                    textShadow: priceDirection === "up" 
                      ? "0 0 20px hsla(142, 70%, 50%, 0.4)" 
                      : priceDirection === "down"
                      ? "0 0 20px hsla(0, 80%, 50%, 0.4)"
                      : "none"
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={`text-3xl font-black font-mono tracking-tighter ${
                    priceDirection === "up" 
                      ? "text-[hsl(var(--neon-green))]" 
                      : priceDirection === "down" 
                      ? "text-[hsl(var(--neon-red))]" 
                      : "text-foreground"
                  }`}
                >
                  ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </motion.span>
              </AnimatePresence>

              <AnimatePresence>
                {priceDirection && (
                  <motion.div
                    initial={{ opacity: 0, x: -10, rotate: priceDirection === "up" ? -45 : 45 }}
                    animate={{ opacity: 1, x: 0, rotate: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className={`p-1 rounded-full ${
                      priceDirection === "up" ? "bg-[hsl(var(--neon-green))]/10" : "bg-[hsl(var(--neon-red))]/10"
                    }`}
                  >
                    {priceDirection === "up" ? (
                      <TrendingUp className="w-5 h-5 text-[hsl(var(--neon-green))]" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-[hsl(var(--neon-red))]" />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* 24h Stats */}
        <div className="flex items-center gap-4 text-xs">
          <div className={`flex items-center gap-1 font-mono font-bold ${isPositive ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"}`}>
            {isPositive ? "+" : ""}{ticker.priceChangePercent.toFixed(2)}%
          </div>
          <div className="text-muted-foreground">
            <span className="opacity-60">24h H:</span>{" "}
            <span className="font-mono text-foreground">${ticker.high24h.toLocaleString()}</span>
          </div>
          <div className="text-muted-foreground">
            <span className="opacity-60">24h L:</span>{" "}
            <span className="font-mono text-foreground">${ticker.low24h.toLocaleString()}</span>
          </div>
          <div className="text-muted-foreground">
            <span className="opacity-60">Vol:</span>{" "}
            <span className="font-mono text-foreground">
              {ticker.volume24h > 1e9
                ? `${(ticker.volume24h / 1e9).toFixed(2)}B`
                : ticker.volume24h > 1e6
                ? `${(ticker.volume24h / 1e6).toFixed(1)}M`
                : ticker.volume24h.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

LiveTicker.displayName = "LiveTicker";
export default LiveTicker;
