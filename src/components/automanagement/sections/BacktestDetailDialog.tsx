import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, CheckCircle2, XCircle } from "lucide-react";
import { RefinementLog } from "@/hooks/useAutoManagement";

interface BacktestDetailDialogProps {
  log: RefinementLog | null;
  onClose: () => void;
}

export const BacktestDetailDialog: React.FC<BacktestDetailDialogProps> = ({
  log,
  onClose,
}) => {
  if (!log) return null;

  const details = (log.backtest_details as any[]) || [];
  const changed = details.filter((d) => d.original_signal !== d.recalc_signal);
  const changedWouldMatch = changed.filter((d) => d.would_match).length;
  const changedWouldFail = changed.length - changedWouldMatch;

  const unchanged = details.filter((d) => d.original_signal === d.recalc_signal);
  const unchangedCorrect = unchanged.filter((d) => d.would_match).length;

  return (
    <Dialog open={!!log} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            Sinais Alterados — {log.asset}/{log.timeframe}
          </DialogTitle>
          <DialogDescription>
            Análises que teriam sinal diferente com os pesos calibrados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
              <div className="text-2xl font-bold text-foreground">{changed.length}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Sinais Alterados</div>
            </div>
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 text-center">
              <div className="text-2xl font-bold text-green-500">{changedWouldMatch}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Acertariam</div>
            </div>
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
              <div className="text-2xl font-bold text-red-500">{changedWouldFail}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Errariam</div>
            </div>
          </div>

          {changed.length > 0 ? (
            <div className={`p-3 rounded-lg text-sm font-medium text-center border ${
              changedWouldMatch > changedWouldFail 
                ? 'bg-green-500/10 border-green-500/30 text-green-500' 
                : changedWouldMatch < changedWouldFail 
                  ? 'bg-red-500/10 border-red-500/30 text-red-500' 
                  : 'bg-muted/20 border-border/30 text-muted-foreground'
            }`}>
              {changedWouldMatch > changedWouldFail 
                ? `✅ ${changedWouldMatch} de ${changed.length} mudanças teriam sido melhores — os pesos calibrados estão aprimorando o sistema.`
                : changedWouldMatch < changedWouldFail
                  ? `⚠️ Apenas ${changedWouldMatch} de ${changed.length} mudanças teriam sido melhores — calibração precisa de mais dados.`
                  : `➡️ Resultado neutro: ${changedWouldMatch} acertos e ${changedWouldFail} erros entre as mudanças.`
              }
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-muted/20 border-border/30 text-sm text-muted-foreground font-medium text-center">
              Nenhuma mudança de sinal detectada no backtest deste período.
            </div>
          )}

          {changed.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Sinal Original</TableHead>
                    <TableHead className="text-xs">→ Recalculado</TableHead>
                    <TableHead className="text-xs text-right">Buy%</TableHead>
                    <TableHead className="text-xs text-right">Sell%</TableHead>
                    <TableHead className="text-xs">Resultado Real</TableHead>
                    <TableHead className="text-xs text-center">Acertaria?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changed.map((d, i) => {
                    const signalColor = (s: string) => s === 'COMPRA' ? 'text-green-500' : s === 'VENDA' ? 'text-red-500' : 'text-muted-foreground';
                    const resultIsWin = d.actual_result?.startsWith('WIN');
                    return (
                      <TableRow key={i}>
                        <TableCell className={`font-bold text-xs ${signalColor(d.original_signal)}`}>
                          {d.original_signal === 'COMPRA' ? '🟢' : d.original_signal === 'VENDA' ? '🔴' : '⚪'} {d.original_signal}
                        </TableCell>
                        <TableCell className={`font-bold text-xs ${signalColor(d.recalc_signal)}`}>
                          {d.recalc_signal === 'COMPRA' ? '🟢' : d.recalc_signal === 'VENDA' ? '🔴' : '⚪'} {d.recalc_signal}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono text-green-500">{d.buy_pct?.toFixed(1)}%</TableCell>
                        <TableCell className="text-right text-xs font-mono text-red-500">{d.sell_pct?.toFixed(1)}%</TableCell>
                        <TableCell className={`text-xs font-bold ${resultIsWin ? 'text-green-500' : 'text-red-500'}`}>
                          {d.actual_result}
                        </TableCell>
                        <TableCell className="text-center">
                          {d.would_match ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="text-[11px] text-muted-foreground pt-2 border-t border-border/20">
            📊 {unchanged.length} análises mantiveram o mesmo sinal ({unchangedCorrect} corretas) — total de {details.length} analisadas.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
