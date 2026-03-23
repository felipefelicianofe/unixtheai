import React from "react";
import { Brain, Sparkles, RefreshCw, ArrowUp, ArrowDown, Minus, Eye, CheckCircle2, XCircle, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from "framer-motion";
import { RefinementWeight, RefinementLog } from "@/hooks/useAutoManagement";

interface RefinementTabProps {
  refinementWeights: RefinementWeight[] | undefined;
  refinementLogs: RefinementLog[] | undefined;
  refineMutation: any;
  setBacktestDetailLog: (log: RefinementLog | null) => void;
}

export const RefinementTab: React.FC<RefinementTabProps> = ({
  refinementWeights,
  refinementLogs,
  refineMutation,
  setBacktestDetailLog,
}) => {
  return (
    <div className="space-y-6">
      <Card className="glass-panel border-primary/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Brain className="w-32 h-32 text-primary" />
        </div>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" />
              <CardTitle>Inteligência de Calibração</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refineMutation.mutate('backtest')} disabled={refineMutation.isPending}>
                <RefreshCw className={`w-4 h-4 mr-2 ${refineMutation.isPending ? 'animate-spin' : ''}`} />
                Run Backtest Only
              </Button>
              <Button variant="default" size="sm" onClick={() => refineMutation.mutate('calibrate')} disabled={refineMutation.isPending}>
                <Sparkles className="w-4 h-4 mr-2" />
                Calibrar Pesos (Auto-Refine)
              </Button>
            </div>
          </div>
          <CardDescription>
            A IA analisa o histórico de acertos e erros para ajustar os pesos de cada indicador técnico automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-background/40 p-4 rounded-xl border border-border/40">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Amostras Analisadas</span>
              <div className="text-2xl font-bold flex items-center gap-2 mt-1">
                {refinementWeights?.reduce((sum, w) => sum + w.sample_count, 0) || 0}
              </div>
            </div>
            <div className="bg-background/40 p-4 rounded-xl border border-border/40">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Indicadores Ativos</span>
              <div className="text-2xl font-bold flex items-center gap-2 mt-1">
                {refinementWeights?.length || 0}
              </div>
            </div>
            <div className="bg-background/40 p-4 rounded-xl border border-border/40">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Última Calibração</span>
              <div className="text-sm font-semibold mt-2">
                {refinementLogs?.[0] ? new Date(refinementLogs[0].created_at).toLocaleString('pt-BR') : 'Aguardando...'}
              </div>
            </div>
            <div className="bg-background/40 p-4 rounded-xl border border-border/40">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Ganhos VR (Média)</span>
              <div className="text-2xl font-bold text-green-500 flex items-center gap-1 mt-1">
                +{(refinementLogs?.slice(0, 5).reduce((sum, log) => sum + (log.projected_wr_new_weights! - (log.overall_wr_before ?? 0)), 0) / 5 || 0).toFixed(1)}pp
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pesos Calibrados do Sistema */}
      {refinementWeights && refinementWeights.length > 0 && (
        <Card className="glass-panel border-muted bg-background/50">
          <CardHeader>
            <CardTitle className="text-sm">Configuração Atual de Pesos (Live Calibrated)</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="max-h-[400px] overflow-y-auto">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead className="text-xs">Indicador</TableHead>
                     <TableHead className="text-xs">Ativo/TF</TableHead>
                     <TableHead className="text-xs text-right">Win Rate</TableHead>
                     <TableHead className="text-xs text-right">Peso Original</TableHead>
                     <TableHead className="text-xs text-right">→ Peso Calibrado</TableHead>
                     <TableHead className="text-xs text-center">Status</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {refinementWeights.map((w) => (
                     <TableRow key={w.id} className="group hover:bg-muted/30">
                       <TableCell className="font-bold py-3">{w.indicator_name}</TableCell>
                       <TableCell><Badge variant="outline" className="text-[9px]">{w.asset}/{w.timeframe}</Badge></TableCell>
                       <TableCell className={`text-right font-mono font-bold ${w.win_rate >= 60 ? 'text-green-500' : 'text-yellow-500'}`}>
                         {w.win_rate.toFixed(1)}% <span className="text-[9px] text-muted-foreground">({w.sample_count} samples)</span>
                       </TableCell>
                       <TableCell className="text-right text-muted-foreground font-mono">{w.original_weight.toFixed(1)}</TableCell>
                       <TableCell className="text-right font-mono font-bold text-primary">
                         {w.calibrated_weight.toFixed(1)}
                         {w.calibrated_weight > w.original_weight ? ' ⬆️' : w.calibrated_weight < w.original_weight ? ' ⬇️' : ''}
                       </TableCell>
                       <TableCell className="text-center">
                         {w.trend === "IMPROVING" ? <ArrowUp className="w-3.5 h-3.5 text-green-500 mx-auto" /> : 
                          w.trend === "DEGRADING" ? <ArrowDown className="w-3.5 h-3.5 text-red-500 mx-auto" /> : 
                          <Minus className="w-3.5 h-3.5 text-muted-foreground mx-auto" />}
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </div>
          </CardContent>
        </Card>
      )}

      {/* Preview de Calibração */}
      {refinementLogs && refinementLogs.length > 0 && (
        <Card className="glass-panel border-muted bg-background/50">
          <CardHeader>
             <CardTitle className="text-sm flex items-center gap-2">
               <Eye className="w-4 h-4" />
               Impacto das Últimas Calibrações
             </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const latestPerAsset = new Map<string, any>();
              refinementLogs.forEach(l => {
                if (!latestPerAsset.has(l.asset + l.timeframe)) latestPerAsset.set(l.asset + l.timeframe, l);
              });
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Array.from(latestPerAsset.values()).map((log: RefinementLog) => {
                    const wrProjected = log.projected_wr_new_weights ?? 0;
                    const wrBefore = log.overall_wr_before ?? 0;
                    const delta = wrProjected - wrBefore;
                    const isImproving = delta > 0;
                    const signalChanges = log.backtest_signal_changes || 0;
                    
                    return (
                      <motion.div 
                        key={log.id} 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 rounded-xl border border-muted bg-background/30 hover:bg-background/60 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="text-sm font-bold">{log.asset}</div>
                            <div className="text-[10px] text-muted-foreground">{log.timeframe} • {new Date(log.created_at).toLocaleDateString('pt-BR')}</div>
                          </div>
                          <Badge variant={isImproving ? 'default' : 'secondary'} className={isImproving ? 'bg-green-500/10 text-green-500 border-green-500/20' : ''}>
                            {isImproving ? 'Aprimorado' : 'Estável'}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex-1">
                            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">WR Atual</div>
                            <div className="text-xl font-bold">{wrBefore.toFixed(1)}%</div>
                          </div>
                          <div className="text-primary opacity-40">→</div>
                          <div className="flex-1 text-right">
                            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">WR Projetado</div>
                            <div className={`text-xl font-bold ${isImproving ? 'text-green-500' : 'text-foreground'}`}>
                              {wrProjected.toFixed(1)}%
                            </div>
                          </div>
                        </div>

                        {/* Metrics: Loss Avoidance, Missed Opportunity, Threshold */}
                        <div className="grid grid-cols-3 gap-2 mb-3 p-2 rounded-lg bg-muted/10 border border-border/20">
                          <div className="text-center">
                            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">🛡️ Loss Evitados</div>
                            <div className={`text-sm font-bold ${(log.loss_avoidance_rate ?? 0) > 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                              {log.loss_avoidance_rate != null ? `${log.loss_avoidance_rate.toFixed(1)}%` : '—'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">⚠️ Oport. Perdidas</div>
                            <div className={`text-sm font-bold ${(log.missed_opportunity_rate ?? 0) > 20 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                              {log.missed_opportunity_rate != null ? `${log.missed_opportunity_rate.toFixed(1)}%` : '—'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">🎯 Threshold</div>
                            <div className="text-sm font-bold text-foreground">
                              {log.effective_threshold != null ? `${log.effective_threshold}%` : '55%'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            {isImproving ? <ArrowUp className="w-3.5 h-3.5 text-green-500" /> : delta < 0 ? <ArrowDown className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
                            <span className={`font-bold ${isImproving ? 'text-green-500' : delta < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(1)}pp
                            </span>
                          </div>
                          <button
                            onClick={() => signalChanges > 0 ? setBacktestDetailLog(log) : null}
                            className={`${signalChanges > 0 ? 'text-primary hover:underline cursor-pointer' : 'text-muted-foreground cursor-default text-xs h-auto p-0'} transition-colors bg-transparent border-none`}
                          >
                            {signalChanges} sinais alterados
                          </button>
                        </div>
                        
                        <div className="mt-3 pt-2 border-t border-border/20 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{log.analysis_count} amostras</span>
                          <span>{log.indicators_adjusted} indicadores ajustados</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Histórico de Calibrações Table */}
      {refinementLogs && refinementLogs.length > 0 && (
        <Card className="glass-panel border-muted bg-background/50">
          <CardHeader>
            <CardTitle className="text-sm">Histórico Completo de Calibrações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {refinementLogs.map((log) => {
                const hasProjected = log.projected_wr_new_weights !== null && log.projected_wr_new_weights !== undefined;
                const delta = hasProjected ? (log.projected_wr_new_weights! - (log.overall_wr_before ?? 0)) : null;
                return (
                  <div key={log.id} className="flex items-center justify-between text-xs p-3 rounded-lg bg-muted/20 border border-border/30">
                    <div className="flex items-center gap-3">
                      <span className="font-bold">{log.asset}/{log.timeframe}</span>
                      <span className="text-muted-foreground">{log.analysis_count} amostras</span>
                      <span className="text-muted-foreground">{log.indicators_adjusted} ajustados</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap justify-end">
                      <span className="font-mono">WR: {log.overall_wr_before?.toFixed(1)}%</span>
                      {hasProjected && (
                        <span className={`font-mono font-bold ${delta! > 0 ? 'text-green-500' : delta! < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                          → {log.projected_wr_new_weights?.toFixed(1)}% ({delta! > 0 ? '+' : ''}{delta!.toFixed(1)}pp)
                        </span>
                      )}
                      {log.loss_avoidance_rate != null && (
                        <span className="text-green-500 text-[10px]">🛡️{log.loss_avoidance_rate.toFixed(0)}% evitados</span>
                      )}
                      {log.backtest_signal_changes > 0 && (
                        <span className="text-primary text-[10px]">{log.backtest_signal_changes} Δ sinais</span>
                      )}
                      <span className="text-muted-foreground text-[10px]">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
