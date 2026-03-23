import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crosshair, Flame, Target, TrendingUp, TrendingDown } from "lucide-react";

interface LiquidityCluster {
  id: string;
  price: number;
  volumeMillions: number;
  type: "LONG_LIQD" | "SHORT_LIQD";
  distance: number; // % from current price
}

function generateMockClusters(basePrice: number): LiquidityCluster[] {
  return [
    { id: "lq-1", price: basePrice * 1.015, volumeMillions: 45.2, type: "SHORT_LIQD", distance: 1.5 },
    { id: "lq-2", price: basePrice * 0.988, volumeMillions: 62.8, type: "LONG_LIQD", distance: 1.2 },
    { id: "lq-3", price: basePrice * 1.032, volumeMillions: 28.1, type: "SHORT_LIQD", distance: 3.2 },
    { id: "lq-4", price: basePrice * 0.972, volumeMillions: 51.4, type: "LONG_LIQD", distance: 2.8 },
    { id: "lq-5", price: basePrice * 0.995, volumeMillions: 38.9, type: "LONG_LIQD", distance: 0.5 },
  ];
}

export default function LiquidityRadar() {
  const basePrice = 69353.66;
  const [clusters, setClusters] = useState<LiquidityCluster[]>([]);
  const [scanPhase, setScanPhase] = useState(0);
  const [sniperTarget, setSniperTarget] = useState<LiquidityCluster | null>(null);

  useEffect(() => {
    setClusters(generateMockClusters(basePrice));
  }, []);

  // Simulate scanning animation
  useEffect(() => {
    const interval = setInterval(() => {
      setScanPhase((p) => (p + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Find nearest cluster as sniper target
  useEffect(() => {
    if (clusters.length > 0) {
      const nearest = [...clusters].sort((a, b) => a.distance - b.distance)[0];
      setSniperTarget(nearest);
    }
  }, [clusters]);

  const maxVol = Math.max(...clusters.map((c) => c.volumeMillions), 1);

  const scanMessages = [
    "Varrendo order book por liquidez institucional...",
    "Mapeando clusters de Stop Loss no mercado...",
    "Identificando zonas de caça Smart Money...",
    `Aguardando varredura de liquidez institucional em $${sniperTarget?.price.toLocaleString("en-US") ?? "---"} para acionar Sniper Entry.`,
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="glass rounded-2xl p-6 relative overflow-hidden"
    >
      {/* Scan glow */}
      <motion.div
        animate={{ opacity: [0.05, 0.12, 0.05] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{ boxShadow: "inset 0 0 80px hsl(var(--neon-blue) / 0.08)" }}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center relative">
          <Crosshair className="w-5 h-5 text-primary" />
          <motion.div
            className="absolute inset-0 rounded-xl border border-primary/40"
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
        </div>
        <div className="flex-1">
          <h3 className="text-foreground font-semibold text-lg">Radar de Liquidez</h3>
          <p className="text-muted-foreground text-xs">Order Book Heatmap — Smart Money Clusters</p>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.div
            className="w-2 h-2 rounded-full bg-primary"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-[10px] text-primary font-medium">SCANNING</span>
        </div>
      </div>

      {/* AI Status Text */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scanPhase}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className="mb-5 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10"
        >
          <p className="text-xs text-primary/80 font-mono">
            <Target className="w-3 h-3 inline mr-1.5 -mt-0.5" />
            {scanMessages[scanPhase]}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Liquidity Clusters */}
      <div className="space-y-2.5">
        {clusters
          .sort((a, b) => b.volumeMillions - a.volumeMillions)
          .map((cluster, i) => {
            const pct = (cluster.volumeMillions / maxVol) * 100;
            const isLong = cluster.type === "LONG_LIQD";
            const isNearest = cluster.id === sniperTarget?.id;

            return (
              <motion.div
                key={cluster.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`relative rounded-xl p-3 border transition-all ${
                  isNearest
                    ? "bg-primary/8 border-primary/30"
                    : "bg-background/30 border-border/20"
                }`}
              >
                {isNearest && (
                  <motion.div
                    className="absolute -left-px top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-primary"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}

                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {isLong ? (
                      <TrendingDown className="w-3.5 h-3.5 text-[hsl(var(--neon-red))]" />
                    ) : (
                      <TrendingUp className="w-3.5 h-3.5 text-[hsl(var(--neon-green))]" />
                    )}
                    <span className="text-sm font-mono font-semibold text-foreground">
                      ${cluster.price.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                    </span>
                    {isNearest && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold">
                        SNIPER TARGET
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span className="text-xs font-mono text-muted-foreground">
                      ${cluster.volumeMillions.toFixed(1)}M
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ({cluster.distance.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {/* Heatmap bar */}
                <div className="h-1.5 rounded-full bg-background/50 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    className={`h-full rounded-full ${
                      isLong
                        ? "bg-gradient-to-r from-[hsl(var(--neon-red))]/60 to-[hsl(var(--neon-red))]"
                        : "bg-gradient-to-r from-[hsl(var(--neon-green))]/60 to-[hsl(var(--neon-green))]"
                    }`}
                    style={{
                      boxShadow: isLong
                        ? "0 0 8px hsl(var(--neon-red) / 0.4)"
                        : "0 0 8px hsl(var(--neon-green) / 0.4)",
                    }}
                  />
                </div>

                <div className="flex justify-between mt-1">
                  <span className={`text-[10px] font-medium ${
                    isLong ? "text-[hsl(var(--neon-red))]/70" : "text-[hsl(var(--neon-green))]/70"
                  }`}>
                    {isLong ? "Liquidação LONG" : "Liquidação SHORT"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {isLong ? "Smart Money caçará longs" : "Short squeeze potencial"}
                  </span>
                </div>
              </motion.div>
            );
          })}
      </div>
    </motion.div>
  );
}
