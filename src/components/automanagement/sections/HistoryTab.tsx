import React from "react";
import { RefreshCw, Trash2, ChevronDown, ChevronUp, Clock, Minus, Target } from "lucide-react";
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
                <div 
                  key={h.id} 
                  className={`p-4 rounded-xl border border-muted/30 bg-background/40 transition-all ${isExpanded ? 'ring-1 ring-primary/40 shadow-lg' : 'hover:bg-background/60 shadow-sm'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-[150px]">
                      <div className="flex flex-col">
                        <span className="font-bold text-lg">{h.asset}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="px-1 text-[9px] uppercase">{h.timeframe}</Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(h.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 flex-1 flex-wrap justify-end md:justify-start">
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Status</span>
                        <StatusBadge status={h.status} closeReason={h.close_reason} closedAt={h.closed_at} />
                      </div>

                      {!isNeutral && (
                        <>
                          <div className="flex flex-col min-w-[80px]">
                            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Sinal</span>
                            <span className={`text-sm font-bold ${isLong ? 'text-green-500' : 'text-red-500'}`}>
                              {h.signal || (isLong ? 'COMPRA' : 'VENDA')}
                            </span>
                          </div>
                          <div className="flex flex-col min-w-[80px]">
                            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Entrada</span>
                            <span className="text-sm font-mono font-semibold">{formatPrice(entryPrice)}</span>
                          </div>
                          <div className="flex flex-col min-w-[80px]">
                            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">P. Atual</span>
                            <span className="text-sm font-mono font-semibold">{formatPrice(displayPrice)}</span>
                          </div>
                          <div className="flex flex-col min-w-[80px]">
                            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">P&L Virtual</span>
                            <span className={`text-sm font-bold font-mono ${pnl > 0 ? 'text-green-500' : pnl < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {pnl > 0 ? '+' : ''}{pnl.toFixed(2)}%
                            </span>
                          </div>
                        </>
                      )}

                      {isNeutral && h.final_confidence_pct && (
                         <div className="flex flex-col">
                            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Confiança</span>
                            <span className="text-xs font-semibold">{h.final_confidence_pct}% | {h.trend || '—'}</span>
                         </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                       <Button 
                        variant="ghost" 
                        size="sm" 
                        className={`h-8 transition-colors ${isExpanded ? 'bg-primary/10 text-primary' : ''}`}
                        onClick={() => setExpandedRowId(isExpanded ? null : h.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <span className="ml-2 text-xs">Detalhes</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-red-500"
                        onClick={() => deleteHistoryMutation.mutate(h.id)}
                        disabled={deleteHistoryMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-4 pt-4 border-t border-border/20 space-y-4 overflow-hidden"
                    >
                      {/* Dashboard with Targets */}
                      {!isNeutral && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase text-muted-foreground">Progresso dos Alvos</h4>
                            <div className="space-y-1.5">
                              <DistanceBar label="TP1" distancePct={safeNum(h.distance_tp1_pct)} isHit={!!h.tp1_hit_time} hitTime={h.tp1_hit_time} color="text-emerald-400" />
                              <DistanceBar label="TP2" distancePct={safeNum(h.distance_tp2_pct)} isHit={!!h.tp2_hit_time} hitTime={h.tp2_hit_time} color="text-green-400" />
                              <DistanceBar label="TP3" distancePct={safeNum(h.distance_tp3_pct)} isHit={!!h.tp3_hit_time} hitTime={h.tp3_hit_time} color="text-green-500" />
                              <DistanceBar label="SL" distancePct={safeNum(h.distance_sl_pct)} isHit={!!h.loss_hit_time} hitTime={h.loss_hit_time} color="text-red-500" />
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase text-muted-foreground">Informações Adicionais</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-2 rounded bg-muted/20 border border-muted/30">
                                <span className="text-[10px] text-muted-foreground block mb-1">Confiança IA</span>
                                <span className="text-sm font-bold text-primary">{h.final_confidence_pct}%</span>
                              </div>
                              <div className="p-2 rounded bg-muted/20 border border-muted/30">
                                <span className="text-[10px] text-muted-foreground block mb-1">Tendência</span>
                                <span className="text-sm font-bold">{h.trend || '—'}</span>
                              </div>
                              {h.close_reason && (
                                <div className="p-2 rounded bg-muted/20 border border-muted/30 col-span-2">
                                  <span className="text-[10px] text-muted-foreground block mb-1">Motivo de Fechamento</span>
                                  <span className="text-sm font-bold text-amber-500">{formatCloseReason(h.close_reason)}</span>
                                  {h.closed_at && (
                                    <span className="text-[10px] text-muted-foreground ml-2">
                                      {new Date(h.closed_at).toLocaleString('pt-BR')}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            {h.last_verified_at && (
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-2">
                                <Clock className="w-3 h-3" />
                                Última verificação: {new Date(h.last_verified_at).toLocaleString('pt-BR')}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {isNeutral && (
                         <div className="p-4 rounded-lg bg-muted/10 border border-muted-foreground/10">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                              <Minus className="w-4 h-4" />
                              <span className="font-medium">Resumo do Estado Neutro</span>
                            </div>
                            <p className="text-sm text-balance">
                              O sistema analisou o mercado mas não encontrou força suficiente para emitir um sinal claro de COMPRA ou VENDA.
                            </p>
                         </div>
                      )}

                      {/* Analysis Results Component */}
                      {h.full_result && (
                        <div className="pt-4 border-t border-border/20">
                          <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                            🔍 Indicadores Técnicos Detalhados
                          </h4>
                          <div className="scale-95 origin-top-left">
                            <AnalysisResults 
                              data={typeof h.full_result === 'string' ? (() => { 
                                try { return JSON.parse(h.full_result); } catch { return h.full_result; } 
                              })() : h.full_result} 
                              onNewAnalysis={() => setExpandedRowId(null)}
                            />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};
