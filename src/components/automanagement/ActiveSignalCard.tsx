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
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { AssetMonitorState, ActiveSignal, MonitorStatus } from "@/hooks/useMonitoringEngine";

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

function statusLabel(status: MonitorStatus): { text: string; shortText: string; color: string; icon: React.ReactNode } {
  switch (status) {
    case "SIGNAL_ACTIVE":
      return { text: "Sinal Ativo", shortText: "Ativo", color: "text-amber-400 border-amber-400/30 bg-amber-400/10", icon: <Zap className="w-3 h-3" /> };
    case "TP1_HIT":
      return { text: "TP1 Atingido • SL → Breakeven", shortText: "TP1 ✓", color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10", icon: <CheckCircle2 className="w-3 h-3" /> };
    case "TP2_HIT":
      return { text: "TP2 Atingido • Buscando TP3", shortText: "TP2 ✓", color: "text-green-400 border-green-400/30 bg-green-400/10", icon: <CheckCircle2 className="w-3 h-3" /> };
    default:
      return { text: status, shortText: status, color: "text-muted-foreground border-muted-foreground/30", icon: null };
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
  const [expanded, setExpanded] = useState(false);
  const { activeSignal, currentPrice, status, asset } = state;
  if (!activeSignal) return null;

  const sig = activeSignal;
  const price = currentPrice ?? sig.entryPrice;
  const pnl = calculatePnl(sig.entryPrice, price, sig.direction, sig.leverage);
  const statusInfo = statusLabel(status);
  const isLong = sig.direction === "LONG";

  // Distance calculations
  const distTP1 = distancePct(price, sig.takeProfit1, sig.entryPrice, sig.direction);
  const distTP2 = sig.takeProfit2 ? distancePct(price, sig.takeProfit2, sig.entryPrice, sig.direction) : null;
  const distTP3 = sig.takeProfit3 ? distancePct(price, sig.takeProfit3, sig.entryPrice, sig.direction) : null;
  const distSL = distancePct(price, sig.currentStopLoss, sig.entryPrice, sig.direction);

  // Progress for TP levels
  const tp1Progress = sig.tp1Hit ? 100 : Math.max(0, Math.min(100, 100 - Math.abs(distTP1) * 10));
  const tp2Progress = sig.tp2Hit ? 100 : (distTP2 !== null ? Math.max(0, Math.min(100, 100 - Math.abs(distTP2) * 10)) : 0);
  const tp3Progress = distTP3 !== null ? Math.max(0, Math.min(100, 100 - Math.abs(distTP3) * 10)) : 0;

  // ── Minimized View ──
  if (!expanded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <Card
          className={`glass-panel overflow-hidden cursor-pointer transition-all duration-200 hover:brightness-110 ${
            isLong
              ? "border-green-500/20 bg-gradient-to-r from-green-500/5 to-transparent"
              : "border-red-500/20 bg-gradient-to-r from-red-500/5 to-transparent"
          }`}
          onClick={() => setExpanded(true)}
        >
          <div
            className={`h-0.5 w-full ${
              isLong ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-red-500 to-orange-400"
            }`}
          />
          <div className="flex items-center justify-between px-4 py-3">
            {/* Left: Asset + Direction */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`p-1.5 rounded-md ${isLong ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}`}>
                {isLong ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
              <span className="font-bold text-sm">{asset}</span>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                {sig.timeframe}
              </Badge>
              {sig.leverage > 1 && (
                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${isLong ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}`}>
                  {sig.leverage}x
                </Badge>
              )}
            </div>

            {/* Center: Status */}
            <Badge variant="outline" className={`text-[9px] px-2 py-0.5 ${statusInfo.color}`}>
              {statusInfo.icon}
              <span className="ml-1">{statusInfo.shortText}</span>
            </Badge>

            {/* Right: P&L + Expand */}
            <div className="flex items-center gap-3">
              <span className={`text-sm font-bold tabular-nums ${pnl.leveraged >= 0 ? "text-green-500" : "text-red-500"}`}>
                {pnl.leveraged >= 0 ? "+" : ""}{pnl.leveraged.toFixed(2)}%
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </Card>
      </motion.div>
    );
  }

  // ── Expanded View ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <Card
        className={`glass-panel overflow-hidden transition-all duration-300 ${
          isLong
            ? "border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent"
            : "border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent"
        }`}
      >
        {/* Animated top bar */}
        <div
          className={`h-1 w-full ${
            isLong ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-red-500 to-orange-400"
          }`}
        />

        <CardHeader className="pb-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Direction icon */}
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`p-2 rounded-lg ${
                  isLong ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
                }`}
              >
                {isLong ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              </motion.div>

              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  {asset}
                  <Badge variant="secondary" className="text-[10px]">
                    {sig.timeframe}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${isLong ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}`}
                  >
                    {isLong ? "LONG" : "SHORT"} {sig.leverage > 1 ? `${sig.leverage}x` : ""}
                  </Badge>
                </CardTitle>
                <span className="text-[10px] text-muted-foreground">
                  Sinal em {new Date(sig.signalTime).toLocaleString("pt-BR")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`}>
                {statusInfo.icon}
                <span className="ml-1">{statusInfo.text}</span>
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-muted-foreground/80"
                onClick={() => setExpanded(false)}
                title="Minimizar"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                onClick={() => {
                  if (confirm("Fechar este sinal manualmente?")) {
                    onManualClose(asset);
                  }
                }}
                title="Fechar sinal manualmente"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Price & P&L Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col p-3 rounded-lg bg-muted/20">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Preço Atual</span>
              <span className="text-lg font-bold">${formatPrice(currentPrice)}</span>
            </div>
            <div className="flex flex-col p-3 rounded-lg bg-muted/20">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Entry</span>
              <span className="text-lg font-semibold text-muted-foreground">
                ${formatPrice(sig.entryPrice)}
              </span>
            </div>
            <div
              className={`flex flex-col p-3 rounded-lg ${
                pnl.leveraged >= 0 ? "bg-green-500/10" : "bg-red-500/10"
              }`}
            >
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                P&L {sig.leverage > 1 ? `${sig.leverage}x` : ""}
              </span>
              <span
                className={`text-lg font-bold ${pnl.leveraged >= 0 ? "text-green-500" : "text-red-500"}`}
              >
                {pnl.leveraged >= 0 ? "+" : ""}
                {pnl.leveraged.toFixed(2)}%
              </span>
              {sig.leverage > 1 && (
                <span className="text-[9px] text-muted-foreground">
                  ({pnl.raw >= 0 ? "+" : ""}{pnl.raw.toFixed(2)}% s/ alav.)
                </span>
              )}
            </div>
          </div>

          {/* Target Levels */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="flex flex-col p-2 rounded bg-green-500/10 border border-green-500/20">
              <span className="text-green-500 font-semibold">TP1</span>
              <span className="font-semibold">{formatPrice(sig.takeProfit1)}</span>
              {sig.tp1Hit && (
                <span className="text-[9px] text-emerald-400">✓ Atingido</span>
              )}
            </div>
            <div className="flex flex-col p-2 rounded bg-green-500/10 border border-green-500/20">
              <span className="text-green-500 font-semibold">TP2</span>
              <span className="font-semibold">{sig.takeProfit2 ? formatPrice(sig.takeProfit2) : "—"}</span>
              {sig.tp2Hit && (
                <span className="text-[9px] text-green-400">✓ Atingido</span>
              )}
            </div>
            <div className="flex flex-col p-2 rounded bg-green-500/10 border border-green-500/20">
              <span className="text-green-500 font-semibold">TP3</span>
              <span className="font-semibold">{sig.takeProfit3 ? formatPrice(sig.takeProfit3) : "—"}</span>
            </div>
            <div className={`flex flex-col p-2 rounded border ${
              sig.tp1Hit
                ? "bg-primary/10 border-primary/20"
                : "bg-red-500/10 border-red-500/20"
            }`}>
              <span className={`font-semibold ${sig.tp1Hit ? "text-primary" : "text-red-500"}`}>
                {sig.tp1Hit ? "BE" : "SL"}
              </span>
              <span className="font-semibold">{formatPrice(sig.currentStopLoss)}</span>
              {sig.tp1Hit && (
                <span className="text-[9px] text-primary">Breakeven</span>
              )}
            </div>
          </div>

          {/* Distance Bars */}
          <div className="space-y-2">
            {/* TP1 */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold w-8 text-emerald-400">TP1</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${sig.tp1Hit ? "bg-emerald-400" : "bg-emerald-400/40"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${tp1Progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className={`text-[10px] min-w-[50px] text-right ${sig.tp1Hit ? "text-emerald-400 font-bold" : "text-muted-foreground"}`}>
                {sig.tp1Hit ? "✓ Hit" : `${Math.abs(distTP1).toFixed(2)}%`}
              </span>
            </div>

            {/* TP2 */}
            {sig.takeProfit2 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold w-8 text-green-400">TP2</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${sig.tp2Hit ? "bg-green-400" : "bg-green-400/40"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${tp2Progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className={`text-[10px] min-w-[50px] text-right ${sig.tp2Hit ? "text-green-400 font-bold" : "text-muted-foreground"}`}>
                  {sig.tp2Hit ? "✓ Hit" : distTP2 !== null ? `${Math.abs(distTP2).toFixed(2)}%` : "—"}
                </span>
              </div>
            )}

            {/* TP3 */}
            {sig.takeProfit3 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold w-8 text-green-500">TP3</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-green-500/40"
                    initial={{ width: 0 }}
                    animate={{ width: `${tp3Progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-[10px] min-w-[50px] text-right text-muted-foreground">
                  {distTP3 !== null ? `${Math.abs(distTP3).toFixed(2)}%` : "—"}
                </span>
              </div>
            )}

            {/* SL */}
            <div className="flex items-center gap-2 text-xs">
              <span className={`font-semibold w-8 ${sig.tp1Hit ? "text-primary" : "text-red-500"}`}>
                {sig.tp1Hit ? "BE" : "SL"}
              </span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${sig.tp1Hit ? "bg-primary/40" : "bg-red-500/40"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(100, 100 - Math.abs(distSL) * 10))}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-[10px] min-w-[50px] text-right text-muted-foreground">
                {Math.abs(distSL).toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Breakeven alert */}
          {sig.tp1Hit && !sig.tp2Hit && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs"
            >
              <Shield className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-primary font-medium">
                SL movido para Breakeven (${formatPrice(sig.entryPrice)}) — Lucro TP1 garantido
              </span>
            </motion.div>
          )}

          {sig.tp2Hit && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-xs"
            >
              <Target className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-green-500 font-medium">
                TP2 atingido — Buscando TP3 com proteção em Breakeven
              </span>
            </motion.div>
          )}

          {/* Peak P&L */}
          {sig.peakPnlPct > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Target className="w-3 h-3" />
              Peak P&L: <span className="text-green-500 font-semibold">+{(sig.peakPnlPct * sig.leverage).toFixed(2)}%</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ActiveSignalCard;
