import React from "react";
import { RefreshCw, Trash2, ChevronDown, ChevronUp, Clock, Minus, Target, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { HistoryRow } from "@/hooks/useAutoManagement";
import { safeNum, formatPrice, formatCloseReason } from "@/lib/automanagement-utils";
import { StatusBadge, DistanceBar } from "@/components/automanagement/HistoryComponents";
import AnalysisResults from "@/components/dashboard/AnalysisResults";

interface HistoryTabProps {
  displayedHistory: HistoryRow[];
  loadingHistory: boolean;
  selectedAssets: Set<string>;
  showNeutros: boolean;
  handleToggleNeutros: (value: boolean) => void;
  verifyMutation: any;
  deleteHistoryMutation: any;
  expandedRowId: string | null;
  setExpandedRowId: (id: string | null) => void;
  historyLimit: number;
  livePriceMap: Map<string, number>;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  displayedHistory,
  loadingHistory,
  selectedAssets,
  showNeutros,
  handleToggleNeutros,
  verifyMutation,
  deleteHistoryMutation,
  expandedRowId,
  setExpandedRowId,
  historyLimit,
  livePriceMap,
}) => {
  return (
    <Card className="glass-panel border-muted bg-background/50">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div>
          <CardTitle>Histórico & Verificação 24/7</CardTitle>
          <CardDescription>
            {selectedAssets.size > 0 
              ? `Filtrando: ${Array.from(selectedAssets).join(', ')}`
              : 'Monitoramento de alvos com preço atual, distância % e P&L virtual.'}
          </CardDescription>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={showNeutros} onCheckedChange={handleToggleNeutros} id="show-neutros" />
            <Label htmlFor="show-neutros" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
              Exibir Neutros
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
            <RefreshCw className={`w-4 h-4 mr-2 ${verifyMutation.isPending ? 'animate-spin' : ''}`} />
            Reverificar Agora
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loadingHistory ? (
            <div className="text-center py-20 text-muted-foreground">
              <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin opacity-20" />
              <p>Carregando histórico...</p>
            </div>
          ) : displayedHistory.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p>{selectedAssets.size > 0 ? 'Nenhum registro para os ativos selecionados.' : 'Nenhum registro encontrado.'}</p>
            </div>
          ) : (
            displayedHistory.slice(0, historyLimit).map((h) => {
              const isExpanded = expandedRowId === h.id;
              const isNeutral = h.status === 'NEUTRAL' || h.signal === 'NEUTRO' || h.signal === 'NEUTRAL';
              const entryPrice = safeNum(h.entry_price);
              const tp1 = safeNum(h.take_profit_1);
              const isLong = !isNeutral && (h.signal === 'COMPRA' || h.signal === 'BUY' || h.signal === 'LONG' || (tp1 !== null && entryPrice !== null && tp1 > entryPrice));
              
              const leverage = h.auto_management_configs?.leverage || 1;
              const livePrice = livePriceMap.get(h.asset);
              const displayPrice = safeNum(livePrice ?? h.current_price);
              
              let pnl = 0;
              if (displayPrice && entryPrice && !isNeutral) {
                const dir = isLong ? 1 : -1;
                const rawPnl = ((displayPrice - entryPrice) / entryPrice) * dir * 100;
                pnl = rawPnl * leverage;
              } else {
                pnl = (safeNum(h.virtual_pnl_pct) || 0) * leverage;
              }

              return (
                <motion.div
                  key={h.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`rounded-lg border transition-all duration-200 overflow-hidden ${
                    isNeutral ? 'border-muted-foreground/10 bg-muted/5' :
                    (h.status?.startsWith('WIN') ? 'border-green-500/10 bg-green-500/5' : 
                     h.status === 'LOSS' ? 'border-red-500/10 bg-red-500/5' : 
                     'border-border/40 bg-background/30 hover:bg-background/50')
                  } ${isExpanded ? 'ring-1 ring-primary/20 shadow-lg' : ''}`}
                >
                  {/* MODO COMPACTO (LINHA ÚNICA) */}
                  <div 
                    className="flex items-center justify-between p-3 cursor-pointer group" 
                    onClick={() => setExpandedRowId(isExpanded ? null : h.id)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Ativo e Direção */}
                      <div className="flex items-center gap-2 min-w-[120px]">
                        {isNeutral ? (
                          <div className="w-8 h-8 rounded bg-muted/20 flex items-center justify-center">
                            <Minus className="w-4 h-4 text-muted-foreground" />
                          </div>
                        ) : isLong ? (
                          <div className="w-8 h-8 rounded bg-green-500/10 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded bg-red-500/10 flex items-center justify-center">
                            <TrendingDown className="w-4 h-4 text-red-500" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-sm leading-tight">{h.asset}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">{h.timeframe} • {new Date(h.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                      </div>

                      {/* Preço e Lucro (Apenas se não for Neutro) */}
                      {!isNeutral && (
                        <>
                          <div className="hidden md:flex flex-col min-w-[100px]">
                            <span className="text-[10px] text-muted-foreground uppercase">Preço</span>
                            <span className="text-sm font-medium font-mono">${formatPrice(displayPrice)}</span>
                          </div>
                          
                          <div className="flex flex-col min-w-[80px]">
                            <span className="text-[10px] text-muted-foreground uppercase">P&L Virtual</span>
                            <span className={`text-sm font-bold font-mono ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {pnl !== null ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%` : '--'}
                            </span>
                          </div>
                        </>
                      )}

                      {/* Confiança Compacta (Neutro) */}
                      {isNeutral && h.final_confidence_pct && (
                         <div className="hidden lg:block flex-1 max-w-[400px]">
                            <p className="text-xs text-muted-foreground truncate italic">IA Confiança: {h.final_confidence_pct}% | {h.trend || 'Estável'}</p>
                         </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={h.status} closeReason={h.close_reason} closedAt={h.closed_at} />
                      
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-20 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); deleteHistoryMutation.mutate(h.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </div>

                  {/* MODO EXPANDIDO (DETALHES TÉCNICOS) */}
                  <motion.div
                    initial={false}
                    animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
                    className="overflow-hidden bg-muted/5"
                  >
                    <div className="p-4 space-y-4 border-t border-border/10">
                      {!isNeutral && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Targets Monitoring */}
                          <div className="space-y-2">
                             <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Monitoramento de Alvos</h4>
                             <div className="space-y-1.5 px-1">
                                <DistanceBar label="TP1" distancePct={safeNum(h.distance_tp1_pct)} isHit={!!h.tp1_hit_time} hitTime={h.tp1_hit_time} color="text-emerald-400" />
                                <DistanceBar label="TP2" distancePct={safeNum(h.distance_tp2_pct)} isHit={!!h.tp2_hit_time} hitTime={h.tp2_hit_time} color="text-green-400" />
                                <DistanceBar label="TP3" distancePct={safeNum(h.distance_tp3_pct)} isHit={!!h.tp3_hit_time} hitTime={h.tp3_hit_time} color="text-green-500" />
                                <DistanceBar label="SL" distancePct={safeNum(h.distance_sl_pct)} isHit={!!h.loss_hit_time} hitTime={h.loss_hit_time} color="text-red-500" />
                             </div>
                          </div>

                          {/* Info Grid */}
                          <div className="space-y-2">
                             <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Métricas Adicionais</h4>
                             <div className="grid grid-cols-2 gap-3">
                               <div className="p-2 rounded bg-background/40 border border-border/20">
                                 <div className="text-[9px] text-muted-foreground uppercase">IA Confiança</div>
                                 <div className="text-sm font-mono font-bold text-primary">{h.final_confidence_pct}%</div>
                               </div>
                               <div className="p-2 rounded bg-background/40 border border-border/20">
                                 <div className="text-[9px] text-muted-foreground uppercase">Trend</div>
                                 <div className="text-sm font-mono font-bold">{h.trend || '—'}</div>
                               </div>
                             </div>
                             {h.last_verified_at && (
                               <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-2">
                                 <Clock className="w-3 h-3" />
                                 Verificado: {new Date(h.last_verified_at).toLocaleString('pt-BR')}
                               </div>
                             )}
                          </div>
                        </div>
                      )}

                      {/* Result Details Component */}
                      {h.full_result && (
                        <div className="pt-4 border-t border-border/20">
                           <AnalysisResults 
                             data={typeof h.full_result === 'string' ? (() => { 
                               try { return JSON.parse(h.full_result as string); } catch { return h.full_result; } 
                             })() : h.full_result} 
                             onNewAnalysis={() => setExpandedRowId(null)}
                           />
                        </div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};
