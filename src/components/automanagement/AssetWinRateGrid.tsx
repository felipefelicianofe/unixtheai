import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HistoryRow } from "@/hooks/useAutoManagement";

interface AssetWinRateGridProps {
  history: HistoryRow[] | undefined;
  selectedAssets: Set<string>;
  toggleAssetFilter: (asset: string) => void;
  setSelectedAssets: (assets: Set<string>) => void;
}

export const AssetWinRateGrid: React.FC<AssetWinRateGridProps> = ({
  history,
  selectedAssets,
  toggleAssetFilter,
  setSelectedAssets,
}) => {
  const isNeutralEntry = (h: HistoryRow) => h.status === 'NEUTRAL' || ((h.signal === 'NEUTRO' || h.signal === 'NEUTRAL') && h.status === 'PENDING');

  const assets = Array.from(new Set(history?.map((h) => h.asset) || []));

  return (
    <Card className="glass-panel border-muted bg-background/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate por Ativo</CardTitle>
          {selectedAssets.size > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedAssets(new Set())}>
              Limpar filtros ({selectedAssets.size})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {assets.map(asset => {
            const assetStr = asset as string;
            const assetAll = history?.filter((h) => h.asset === asset) || [];
            const assetActionable = assetAll.filter((h) => !isNeutralEntry(h));
            const assetWins = assetActionable.filter((h) => h.status?.startsWith('WIN')).length;
            const assetLosses = assetActionable.filter((h) => h.status === 'LOSS').length;
            const assetNeutrals = assetAll.filter((h) => isNeutralEntry(h)).length;
            const totalFinished = assetWins + assetLosses;
            const assetWinRate = totalFinished > 0 ? (assetWins / totalFinished) * 100 : 0;
            const assetUL = assetActionable.reduce((sum: number, h) => {
              if (h.status === 'WIN_TP1') return sum + 1;
              if (h.status === 'WIN_TP2') return sum + 2;
              if (h.status === 'WIN_TP3' || h.status === 'WIN') return sum + 3;
              if (h.status === 'LOSS') return sum - 1;
              return sum;
            }, 0);
            const isActive = selectedAssets.has(assetStr);
            const noFilter = selectedAssets.size === 0;

            return (
              <motion.div
                key={assetStr}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleAssetFilter(assetStr)}
                className={`flex flex-col gap-1 p-3 rounded-lg min-w-[120px] cursor-pointer select-none transition-all duration-200 border ${
                  isActive
                    ? 'border-primary bg-primary/10 shadow-[0_0_15px_hsl(var(--primary)/0.3)] ring-1 ring-primary/40'
                    : noFilter
                      ? 'border-transparent bg-secondary/30 hover:border-muted-foreground/20 hover:bg-secondary/50'
                      : 'border-transparent bg-secondary/10 opacity-40 hover:opacity-70'
                }`}
              >
                <span className={`text-xs font-semibold transition-colors ${isActive ? 'text-primary' : ''}`}>{assetStr}</span>
                <span className={`text-lg font-bold ${assetWinRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                  {totalFinished > 0 ? `${assetWinRate.toFixed(1)}%` : '-'}
                </span>
                <span className="text-[10px] text-muted-foreground">({assetWins}W / {assetLosses}L{assetNeutrals > 0 ? ` / ${assetNeutrals}N` : ''})</span>
                <span className={`text-[10px] font-semibold ${assetUL > 0 ? 'text-emerald-400' : assetUL < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                  UL: {assetUL > 0 ? `+${assetUL}` : assetUL}
                </span>
              </motion.div>
            );
          })}
          {(!history || history.length === 0) && (
            <span className="text-xs text-muted-foreground">Nenhum dado disponível.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
