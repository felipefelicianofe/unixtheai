import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Clock,
  X,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AssetMonitorState, MonitorStatus } from "@/hooks/useMonitoringEngine";

interface ActiveSignalCardProps {
  state: AssetMonitorState;
  onManualClose: (asset: string) => void;
}

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value);
  if (abs >= 10000) return value.toFixed(1);
  if (abs >= 1000) return value.toFixed(1);
  if (abs >= 100) return value.toFixed(2);
  if (abs >= 1) return value.toFixed(4);
  return value.toFixed(6);
}

function calculatePnl(
  entryPrice: number,
  currentPrice: number,
  direction: "LONG" | "SHORT",
  leverage: number
): { raw: number; leveraged: number } {
  const raw =
    direction === "LONG"
      ? ((currentPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - currentPrice) / entryPrice) * 100;
  return { raw, leveraged: raw * leverage };
}

function statusLabel(status: MonitorStatus): { text: string; color: string; icon: React.ReactNode } {
  switch (status) {
    case "SIGNAL_ACTIVE":
      return { text: "Monitorando", color: "text-amber-400 border-amber-400/30 bg-amber-400/10", icon: <Zap className="w-3 h-3" /> };
    case "TP1_HIT":
      return { text: "TP1 Hit • BE", color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10", icon: <CheckCircle2 className="w-3 h-3" /> };
    case "TP2_HIT":
      return { text: "TP2 Hit • Buscando TP3", color: "text-green-400 border-green-400/30 bg-green-400/10", icon: <CheckCircle2 className="w-3 h-3" /> };
    default:
      return { text: status, color: "text-muted-foreground border-muted-foreground/30", icon: null };
  }
}

function distancePct(
  current: number,
  target: number,
  entry: number,
  direction: "LONG" | "SHORT"
): number {
  if (direction === "LONG") {
    return ((target - current) / current) * 100;
  } else {
    return ((current - target) / current) * 100;
  }
}

const ActiveSignalCard: React.FC<ActiveSignalCardProps> = ({ state, onManualClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { activeSignal, currentPrice, status, asset } = state;
  if (!activeSignal) return null;

  const sig = activeSignal;
  const price = currentPrice ?? sig.entryPrice;
  const pnl = calculatePnl(sig.entryPrice, price, sig.direction, sig.leverage);
  const statusInfo = statusLabel(status);
  const isLong = sig.direction === "LONG";

  const distTP1 = distancePct(price, sig.takeProfit1, sig.entryPrice, sig.direction);
  const distTP2 = sig.takeProfit2 ? distancePct(price, sig.takeProfit2, sig.entryPrice, sig.direction) : null;
  const distTP3 = sig.takeProfit3 ? distancePct(price, sig.takeProfit3, sig.entryPrice, sig.direction) : null;
  const distSL = distancePct(price, sig.currentStopLoss, sig.entryPrice, sig.direction);

  const tp1Progress = sig.tp1Hit ? 100 : Math.max(0, Math.min(100, 100 - Math.abs(distTP1) * 10));
  const tp2Progress = sig.tp2Hit ? 100 : (distTP2 !== null ? Math.max(0, Math.min(100, 100 - Math.abs(distTP2) * 10)) : 0);
  const tp3Progress = distTP3 !== null ? Math.max(0, Math.min(100, 100 - Math.abs(distTP3) * 10)) : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`rounded-lg border transition-all duration-200 overflow-hidden ${
        isLong ? 'border-green-500/10 bg-green-500/5' : 'border-red-500/10 bg-red-500/5'
      } ${isExpanded ? 'ring-1 ring-primary/20 shadow-lg' : ''}`}
    >
      {/* LINHA COMPACTA (MASTER) */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4 flex-1">
          {/* Asset Info */}
          <div className="flex items-center gap-2 min-w-[120px]">
            <div className={`w-8 h-8 rounded flex items-center justify-center ${isLong ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              {isLong ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">{asset}</div>
              <div className="text-[10px] text-muted-foreground uppercase">{sig.timeframe} • {sig.leverage}x</div>
            </div>
          </div>

          {/* Current Price */}
          <div className="hidden md:flex flex-col min-w-[100px]">
            <span className="text-[10px] text-muted-foreground uppercase">Preço</span>
            <span className="text-sm font-medium font-mono">${formatPrice(currentPrice)}</span>
          </div>

          {/* P&L Live */}
          <div className="flex flex-col min-w-[80px]">
            <span className="text-[10px] text-muted-foreground uppercase">P&L Live</span>
            <span className={`text-sm font-bold font-mono ${pnl.leveraged >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {pnl.leveraged >= 0 ? '+' : ''}{pnl.leveraged.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`text-[10px] hidden sm:flex ${statusInfo.color}`}>
            {statusInfo.text}
          </Badge>

          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground opacity-20 group-hover:opacity-100 transition-opacity hover:text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Encerrar ${asset} manualmente?`)) onManualClose(asset);
              }}
            >
              <X className="w-4 h-4" />
            </Button>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </div>

      {/* MODO EXPANDIDO (DETAILS) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-muted/5 border-t border-border/10"
          >
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Levels */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Metas da Operação</h4>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="p-2 rounded bg-background/40 border border-border/20">
                      <div className="text-[9px] text-muted-foreground uppercase">Entry</div>
                      <div className="text-xs font-mono font-bold">${formatPrice(sig.entryPrice)}</div>
                    </div>
                    <div className={`p-2 rounded border transition-colors ${sig.tp1Hit ? 'bg-green-500/20 border-green-500/40' : 'bg-green-500/5 border-green-500/20'}`}>
                      <div className="text-[9px] text-green-500/70 uppercase">TP1</div>
                      <div className="text-xs font-mono font-bold text-green-500">${formatPrice(sig.takeProfit1)}</div>
                    </div>
                    <div className={`p-2 rounded border transition-colors ${sig.tp2Hit ? 'bg-green-500/20 border-green-500/40' : 'bg-green-500/5 border-green-500/20'}`}>
                      <div className="text-[9px] text-green-500/70 uppercase">TP2</div>
                      <div className="text-xs font-mono font-bold text-green-500">${sig.takeProfit2 ? formatPrice(sig.takeProfit2) : '-'}</div>
                    </div>
                    <div className={`p-2 rounded border transition-colors ${sig.tp1Hit ? 'bg-primary/20 border-primary/40' : 'bg-red-500/5 border-red-500/20'}`}>
                      <div className={`text-[9px] uppercase ${sig.tp1Hit ? 'text-primary' : 'text-red-500/70'}`}>{sig.tp1Hit ? 'BE' : 'SL'}</div>
                      <div className={`text-xs font-mono font-bold ${sig.tp1Hit ? 'text-primary' : 'text-red-500'}`}>${formatPrice(sig.currentStopLoss)}</div>
                    </div>
                  </div>
                </div>

                {/* Progress Bars */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Distância dos Alvos</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold w-8 text-emerald-400 text-[10px]">TP1</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div className="h-full bg-emerald-400" initial={{ width: 0 }} animate={{ width: `${tp1Progress}%` }} />
                      </div>
                      <span className="text-[10px] min-w-[40px] text-right font-mono">{sig.tp1Hit ? 'OK' : `${Math.abs(distTP1).toFixed(1)}%`}</span>
                    </div>
                    {sig.takeProfit2 && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold w-8 text-green-400 text-[10px]">TP2</span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <motion.div className="h-full bg-green-400" initial={{ width: 0 }} animate={{ width: `${tp2Progress}%` }} />
                        </div>
                        <span className="text-[10px] min-w-[40px] text-right font-mono">{sig.tp2Hit ? 'OK' : `${Math.abs(distTP2!).toFixed(1)}%`}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`font-semibold w-8 text-[10px] ${sig.tp1Hit ? 'text-primary' : 'text-red-500'}`}>{sig.tp1Hit ? 'BE' : 'SL'}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div className={`h-full ${sig.tp1Hit ? 'bg-primary' : 'bg-red-500'}`} initial={{ width: 0 }} animate={{ width: `${Math.max(0, 100 - Math.abs(distSL) * 10)}%` }} />
                      </div>
                      <span className="text-[10px] min-w-[40px] text-right font-mono">{Math.abs(distSL).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status footer */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/5">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  <span>Entrada: {new Date(sig.signalTime).toLocaleString('pt-BR')}</span>
                </div>
                {sig.peakPnlPct > 0 && (
                  <span className="text-green-500/80 font-medium">Máximo atingido: +{(sig.peakPnlPct * sig.leverage).toFixed(2)}%</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ActiveSignalCard;
