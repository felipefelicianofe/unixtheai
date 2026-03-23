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
        <div className="flex flex-wrap gap-2">
          {assets.map(asset => {
            const assetStr = asset as string;
            const assetAll = history?.filter((h) => h.asset === asset) || [];
            const assetActionable = assetAll.filter((h) => !isNeutralEntry(h));
            const assetWins = assetActionable.filter((h) => h.status?.startsWith('WIN')).length;
            const assetLosses = assetActionable.filter((h) => h.status === 'LOSS').length;
            const totalFinished = assetWins + assetLosses;
            const assetWinRate = totalFinished > 0 ? (assetWins / totalFinished) * 100 : 0;
            
            const isActive = selectedAssets.has(assetStr);
            const noFilter = selectedAssets.size === 0;

            return (
              <motion.div
                key={assetStr}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleAssetFilter(assetStr)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer select-none transition-all duration-200 border text-xs font-medium ${
                  isActive
                    ? 'border-primary bg-primary/20 text-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.2)]'
                    : noFilter
                      ? 'border-border/40 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      : 'border-transparent bg-secondary/5 text-muted-foreground/40'
                }`}
              >
                <span>{assetStr}</span>
                <span className={`font-bold ${assetWinRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                  {totalFinished > 0 ? `${assetWinRate.toFixed(0)}%` : '-'}
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
