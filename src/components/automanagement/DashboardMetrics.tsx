import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Target, Percent, ShieldOff } from "lucide-react";

interface DashboardMetricsProps {
  winRate: number;
  originalWinRate?: number;
  totalWins: number;
  totalLoss: number;
  totalFinalized: number;
  totalPending: number;
  totalNeutral: number;
  totalFiltered?: number;
  totalUL: number;
  tp1Wins: number;
  tp2Wins: number;
  tp3Wins: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1 }
};

const DashboardMetrics: React.FC<DashboardMetricsProps> = ({
  winRate,
  originalWinRate,
  totalWins,
  totalLoss,
  totalFinalized,
  totalPending,
  totalNeutral,
  totalFiltered = 0,
  totalUL,
  tp1Wins,
  tp2Wins,
  tp3Wins,
}) => {
  const wrImprovement = originalWinRate != null ? winRate - originalWinRate : 0;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 md:grid-cols-6 gap-4"
    >
      <motion.div variants={itemVariants}>
        <Card className="glass-panel border-primary/30 bg-gradient-to-b from-primary/10 to-transparent shadow-lg shadow-primary/5 hover:shadow-primary/10 transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
              <Percent className="w-4 h-4" /> Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground drop-shadow-md tracking-tight">{winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground/80 mt-1 font-medium">{totalWins}W / {totalLoss}L</p>
            {wrImprovement !== 0 && originalWinRate != null && (
              <p className={`text-[10px] mt-0.5 font-bold ${wrImprovement > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {wrImprovement > 0 ? '↑' : '↓'} {Math.abs(wrImprovement).toFixed(1)}pp vs sem filtros ({originalWinRate.toFixed(1)}%)
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
      
      <motion.div variants={itemVariants}>
        <Card className="glass-panel border-muted/50 bg-gradient-to-b from-muted/20 to-transparent shadow-lg transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Resolvidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground drop-shadow-md tracking-tight">{totalFinalized}</div>
            {(totalNeutral > 0 || totalPending > 0) && (
              <p className="text-[10px] text-muted-foreground/80 mt-1 font-medium">
                {totalPending > 0 && `⏳ ${totalPending} pendentes`}
                {totalPending > 0 && totalNeutral > 0 && ' · '}
                {totalNeutral > 0 && `➡️ ${totalNeutral} neutros`}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
      
      <motion.div variants={itemVariants}>
        <Card className="glass-panel border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-transparent shadow-lg shadow-emerald-500/5 hover:shadow-emerald-500/10 transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-500 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Wins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)] tracking-tight">{totalWins}</div>
            <div className="flex gap-2 mt-1 text-[10px] text-emerald-500/80 font-medium">
              <span>TP1: {tp1Wins}</span>
              <span>TP2: {tp2Wins}</span>
              <span>TP3: {tp3Wins}</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      
      <motion.div variants={itemVariants}>
        <Card className="glass-panel border-red-500/30 bg-gradient-to-b from-red-500/10 to-transparent shadow-lg shadow-red-500/5 hover:shadow-red-500/10 transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-500 flex items-center gap-2">
              <XCircle className="w-4 h-4" /> Losses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.3)] tracking-tight">{totalLoss}</div>
          </CardContent>
        </Card>
      </motion.div>

      {totalFiltered > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="glass-panel border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent shadow-lg shadow-amber-500/5 hover:shadow-amber-500/10 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-500 flex items-center gap-2">
                <ShieldOff className="w-4 h-4" /> Filtrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)] tracking-tight">{totalFiltered}</div>
              <p className="text-[10px] text-amber-500/80 mt-1 font-medium">Sinais bloqueados</p>
            </CardContent>
          </Card>
        </motion.div>
      )}
      
      <motion.div variants={itemVariants}>
        <Card className={`glass-panel bg-gradient-to-b shadow-lg transition-all duration-300 ${
          totalUL > 0 
            ? 'border-emerald-400/30 from-emerald-400/10 shadow-emerald-400/10 hover:shadow-emerald-400/20' 
            : totalUL < 0 
              ? 'border-red-500/30 from-red-500/10 shadow-red-500/10 hover:shadow-red-500/20' 
              : 'border-muted/50 from-muted/10'
        }`}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 ${totalUL > 0 ? 'text-emerald-400' : totalUL < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
              <Target className="w-4 h-4" /> P&L Virtual (UL)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-black tracking-tight ${
              totalUL > 0 ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]' : 
              totalUL < 0 ? 'text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.4)]' : 
              'text-muted-foreground'
            }`}>
              {totalUL > 0 ? `+${totalUL}` : totalUL}
            </div>
            <p className="text-[10px] text-muted-foreground/80 mt-1 font-medium uppercase tracking-wider">Unidades Lucrativas</p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default DashboardMetrics;
