import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssetItem {
  symbol: string;
  label: string;
}

interface Props {
  assets: AssetItem[];
  selectedAsset: string;
  onSelectAsset: (symbol: string) => void;
  prices: Map<string, { price: number; change24h: number }>;
}

const MultiAssetTicker = memo(({ assets, selectedAsset, onSelectAsset, prices }: Props) => {
  return (
    <div className="glass-card rounded-2xl p-3 border border-border/20 overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-2 min-w-max">
        {assets.map((asset) => {
          const data = prices.get(asset.symbol);
          const isActive = selectedAsset === asset.symbol;
          const isPositive = (data?.change24h || 0) >= 0;

          return (
            <motion.button
              key={asset.symbol}
              onClick={() => onSelectAsset(asset.symbol)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all min-w-[160px]",
                isActive
                  ? "bg-primary/15 border border-primary/30 shadow-lg shadow-primary/10"
                  : "bg-muted/20 border border-transparent hover:bg-muted/40"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeAssetIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full"
                  transition={{ type: "spring", bounce: 0.2 }}
                />
              )}
              <div className="flex flex-col items-start">
                <span className="text-xs font-bold text-foreground tracking-wider">{asset.label}</span>
                {data ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-mono font-bold text-foreground">
                      ${data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-mono font-bold flex items-center gap-0.5",
                        isPositive ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"
                      )}
                    >
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {isPositive ? "+" : ""}
                      {data.change24h.toFixed(2)}%
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground animate-pulse">Carregando...</span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
});

MultiAssetTicker.displayName = "MultiAssetTicker";
export default MultiAssetTicker;
