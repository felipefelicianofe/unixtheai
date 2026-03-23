import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

export function StatusBadge({ status, closeReason, closedAt }: { status: string; closeReason?: string | null; closedAt?: string | null }) {
  const isBEClose = closeReason === "BREAKEVEN";
  const isFinalized = !!closedAt;

  switch (status) {
    case "PENDING":
      return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 bg-yellow-500/5">⏳ Aguardando</Badge>;
    case "NEUTRAL":
      return <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 bg-muted/10">➡️ Neutro</Badge>;
    case "WIN_TP1":
      if (isBEClose) {
        return <Badge variant="outline" className="text-amber-400 border-amber-400/30 bg-amber-400/10">🎯 TP1 → BE</Badge>;
      }
      return <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10">{isFinalized ? '🎯 Win TP1' : '🎯 Win TP1'}</Badge>;
    case "WIN_TP2":
      if (isBEClose) {
        return <Badge variant="outline" className="text-amber-400 border-amber-400/30 bg-amber-400/10">🎯🎯 TP2 → BE</Badge>;
      }
      return <Badge variant="outline" className="text-green-400 border-green-400/30 bg-green-400/10">🎯🎯 Win TP2</Badge>;
    case "WIN_TP3":
    case "WIN":
      return <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10">🏆 Win TP3</Badge>;
    case "LOSS":
      return <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10">❌ Loss</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function DistanceBar({ label, distancePct, isHit, hitTime, color }: { 
  label: string; distancePct: number | null; isHit: boolean; hitTime?: string | null; color: string 
}) {
  if (isHit) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className={`font-semibold w-8 ${color}`}>{label}</span>
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${color === 'text-green-500' ? 'bg-green-500' : color === 'text-emerald-400' ? 'bg-emerald-400' : 'bg-red-500'}`} style={{ width: '100%' }} />
        </div>
        <CheckCircle2 className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-muted-foreground text-[10px] min-w-[60px]">
          {hitTime ? new Date(hitTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Hit'}
        </span>
      </div>
    );
  }

  if (distancePct === null || distancePct === undefined) return null;

  const progressValue = Math.max(0, Math.min(100, 100 - Math.abs(distancePct) * 10));

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`font-semibold w-8 ${color}`}>{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${distancePct <= 0 ? 'bg-green-500' : color === 'text-red-500' ? 'bg-red-500/60' : 'bg-primary/40'}`} 
          style={{ width: `${progressValue}%` }} 
        />
      </div>
      <span className={`text-[10px] min-w-[55px] text-right ${distancePct <= 0 ? 'text-green-500 font-bold' : 'text-muted-foreground'}`}>
        {distancePct > 0 ? `${distancePct.toFixed(2)}%` : distancePct <= 0 ? 'Atingido!' : '-'}
      </span>
    </div>
  );
}
