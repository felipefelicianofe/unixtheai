import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Wifi, WifiOff, Zap, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AssetMonitorState } from "@/hooks/useMonitoringEngine";

interface MonitoringDashboardProps {
  monitoredAssets: AssetMonitorState[];
  engineRunning: boolean;
  totalRequests: number;
  totalSuccess: number;
}

function formatPrice(value: number | null): string {
  if (value === null) return "—";
  const abs = Math.abs(value);
  if (abs >= 10000) return value.toFixed(1);
  if (abs >= 100) return value.toFixed(2);
  if (abs >= 1) return value.toFixed(4);
  return value.toFixed(6);
}

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({
  monitoredAssets,
  engineRunning,
  totalRequests,
  totalSuccess,
}) => {
  const successRate = totalRequests > 0 ? ((totalSuccess / totalRequests) * 100).toFixed(0) : "—";
  const activeSignalCount = monitoredAssets.filter(a => a.activeSignal !== null).length;

  return (
    <Card className="glass-panel border-primary/20 bg-background/50 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {/* Heartbeat icon */}
            <motion.div
              animate={engineRunning ? {
                scale: [1, 1.3, 1],
                opacity: [0.7, 1, 0.7],
              } : {}}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Activity className={`w-4 h-4 ${engineRunning ? "text-green-500" : "text-muted-foreground"}`} />
            </motion.div>
            Monitor 24/7
          </CardTitle>
          <div className="flex items-center gap-3">
            {activeSignalCount > 0 && (
              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30 bg-amber-400/5">
                <Zap className="w-3 h-3 mr-1" />
                {activeSignalCount} {activeSignalCount === 1 ? "sinal ativo" : "sinais ativos"}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={`text-[10px] ${
                engineRunning
                  ? "text-green-500 border-green-500/30 bg-green-500/5"
                  : "text-muted-foreground border-muted-foreground/30"
              }`}
            >
              {engineRunning ? (
                <>
                  <Wifi className="w-3 h-3 mr-1" /> Online
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 mr-1" /> Offline
                </>
              )}
            </Badge>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {totalRequests} req · {successRate}% ok
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {monitoredAssets.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Nenhum ativo monitorado. Ative configurações para iniciar.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            <AnimatePresence mode="popLayout">
              {monitoredAssets.map((asset) => {
                const hasSignal = asset.activeSignal !== null;
                const hasError = asset.error !== null;
                const lastPulseAgo = asset.lastPulseAt > 0
                  ? Math.round((Date.now() - asset.lastPulseAt) / 1000)
                  : null;

                return (
                  <motion.div
                    key={asset.asset}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={`
                      relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300
                      ${hasSignal
                        ? "border-amber-400/40 bg-amber-400/5"
                        : hasError
                          ? "border-red-500/30 bg-red-500/5"
                          : "border-muted-foreground/15 bg-muted/10"
                      }
                    `}
                  >
                    {/* Pulse indicator light */}
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                          hasError
                            ? "bg-red-500"
                            : hasSignal
                              ? "bg-amber-400"
                              : "bg-green-500"
                        }`}
                      />
                      {/* Pulse glow ring */}
                      <AnimatePresence>
                        {asset.pulseActive && (
                          <motion.div
                            initial={{ scale: 1, opacity: 0.8 }}
                            animate={{ scale: 2.5, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${
                              hasError
                                ? "bg-red-500"
                                : hasSignal
                                  ? "bg-amber-400"
                                  : "bg-green-500"
                            }`}
                          />
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Asset info */}
                    <div className="flex flex-col">
                      <span className="text-xs font-bold leading-tight">{asset.asset}</span>
                      <span className="text-[9px] text-muted-foreground leading-tight">
                        {asset.currentPrice !== null ? `$${formatPrice(asset.currentPrice)}` : "—"}
                      </span>
                    </div>

                    {/* Status indicator */}
                    {hasSignal && (
                      <div className="flex-shrink-0">
                        {asset.status === "TP1_HIT" ? (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 text-emerald-400 border-emerald-400/30 bg-emerald-400/10">
                            TP1 ✓
                          </Badge>
                        ) : asset.status === "TP2_HIT" ? (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 text-green-400 border-green-400/30 bg-green-400/10">
                            TP2 ✓
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 text-amber-400 border-amber-400/30 bg-amber-400/10">
                            🔒
                          </Badge>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MonitoringDashboard;
