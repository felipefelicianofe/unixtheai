import React from "react";
import { Trash2, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HistoryRow } from "@/hooks/useAutoManagement";
import { StatusBadge } from "@/components/automanagement/HistoryComponents";

interface TrashTabProps {
  deletedHistory: HistoryRow[] | undefined;
  loadingDeleted: boolean;
  restoreHistoryMutation: any;
}

export const TrashTab: React.FC<TrashTabProps> = ({
  deletedHistory,
  loadingDeleted,
  restoreHistoryMutation,
}) => {
  return (
    <Card className="glass-panel border-muted bg-background/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-muted-foreground" />
          Lixeira
        </CardTitle>
        <CardDescription>
          Análises excluídas que podem ser restauradas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingDeleted ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : !deletedHistory || deletedHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trash2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Nenhum registro na lixeira.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {deletedHistory.map((h) => {
              const isNeutral = h.status === 'NEUTRAL' || h.signal === 'NEUTRO' || h.signal === 'NEUTRAL';
              return (
                <div key={h.id} className="flex items-center justify-between p-3 rounded-lg border border-muted/30 bg-muted/5">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">{h.asset}</span>
                    <Badge variant="secondary" className="text-[10px]">{h.timeframe}</Badge>
                    <StatusBadge status={h.status || 'PENDING'} />
                    {!isNeutral && h.signal && (
                      <span className={`text-xs font-semibold ${h.signal === 'COMPRA' || h.signal === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>
                        {h.signal}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">
                      Excluído em {h.deleted_at ? new Date(h.deleted_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => restoreHistoryMutation.mutate(h.id)}
                      disabled={restoreHistoryMutation.isPending}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" /> Restaurar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
