import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Target } from "lucide-react";

interface DashboardMetricsProps {
  winRate: number;
  totalWins: number;
  totalLoss: number;
  totalFinalized: number;
  totalPending: number;
  totalNeutral: number;
  totalUL: number;
  tp1Wins: number;
  tp2Wins: number;
  tp3Wins: number;
}

const DashboardMetrics: React.FC<DashboardMetricsProps> = ({
  winRate,
  totalWins,
  totalLoss,
  totalFinalized,
  totalPending,
  totalNeutral,
  totalUL,
  tp1Wins,
  tp2Wins,
  tp3Wins,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card className="glass-panel border-primary/20 bg-background/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">{winRate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground mt-1">{totalWins}W / {totalLoss}L</p>
        </CardContent>
      </Card>
      
      <Card className="glass-panel border-muted bg-background/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">{totalFinalized}</div>
          {(totalNeutral > 0 || totalPending > 0) && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {totalPending > 0 && `⏳ ${totalPending} pendentes`}
              {totalPending > 0 && totalNeutral > 0 && ' · '}
              {totalNeutral > 0 && `➡️ ${totalNeutral} neutros`}
            </p>
          )}
        </CardContent>
      </Card>
      
      <Card className="glass-panel border-green-500/20 bg-background/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Wins
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-500">{totalWins}</div>
          <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
            <span>TP1: {tp1Wins}</span>
            <span>TP2: {tp2Wins}</span>
            <span>TP3: {tp3Wins}</span>
          </div>
        </CardContent>
      </Card>
      
      <Card className="glass-panel border-red-500/20 bg-background/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" /> Losses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-500">{totalLoss}</div>
        </CardContent>
      </Card>
      
      <Card className={`glass-panel bg-background/50 ${totalUL >= 0 ? 'border-emerald-400/20' : 'border-red-500/20'}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> UL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${totalUL > 0 ? 'text-emerald-400' : totalUL < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
            {totalUL > 0 ? `+${totalUL}` : totalUL}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Unidades Lucrativas</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardMetrics;
