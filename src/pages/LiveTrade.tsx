import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Radio, Wifi, WifiOff, Plus, X } from "lucide-react";
import AppNavBar from "@/components/AppNavBar";
import MultiAssetTicker from "@/components/livetrade/MultiAssetTicker";
import DepthChart from "@/components/livetrade/DepthChart";
import OrderPanel from "@/components/livetrade/OrderPanel";
import AIAssistant from "@/components/livetrade/AIAssistant";
import LivePositionsPanel from "@/components/livetrade/LivePositionsPanel";
import TradeHistory from "@/components/livetrade/TradeHistory";
import LiveTicker from "@/components/dashboard/LiveTicker";
import { useLiveTradeEngine } from "@/hooks/useLiveTradeEngine";
import { useOrderBook } from "@/hooks/useOrderBook";
import { toBinanceSymbol } from "@/hooks/useBinanceSocket";
import { fetchBinancePricesBatch } from "@/lib/binanceApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const DEFAULT_ASSETS = [
  { symbol: "BTCUSDT", label: "BTC/USDT" },
  { symbol: "ETHUSDT", label: "ETH/USDT" },
  { symbol: "SOLUSDT", label: "SOL/USDT" },
  { symbol: "BNBUSDT", label: "BNB/USDT" },
  { symbol: "XRPUSDT", label: "XRP/USDT" },
];

export default function LiveTrade() {
  const [selectedAsset, setSelectedAsset] = useState("BTCUSDT");
  const [assets, setAssets] = useState(DEFAULT_ASSETS);
  const [newAsset, setNewAsset] = useState("");
  const [prices, setPrices] = useState<Map<string, { price: number; change24h: number }>>(new Map());
  const [isConnected] = useState(false); // Will be true when broker keys are set
  const [accountBalance] = useState(0);

  const {
    ticker,
    wsConnected,
    connectionStatus,
    priceDirection,
    positions,
    aiSignal,
    fetchPositions,
    refreshAI,
    binanceSymbol,
  } = useLiveTradeEngine({ selectedAsset, isConnected });

  const { orderBook, connected: bookConnected } = useOrderBook({
    symbol: toBinanceSymbol(selectedAsset) || "btcusdt",
    enabled: true,
  });

  // Batch price fetch for ticker bar
  const priceInterval = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => {
    const fetchPrices = async () => {
      const symbols = assets.map((a) => a.symbol);
      const batch = await fetchBinancePricesBatch(symbols);
      const newPrices = new Map<string, { price: number; change24h: number }>();
      batch.forEach((price, symbol) => {
        const prev = prices.get(symbol);
        newPrices.set(symbol, {
          price,
          change24h: prev ? ((price - prev.price) / prev.price) * 100 * 100 : 0, // amplified for visibility
        });
      });
      setPrices(newPrices);
    };

    fetchPrices();
    priceInterval.current = setInterval(fetchPrices, 3000);
    return () => {
      if (priceInterval.current) clearInterval(priceInterval.current);
    };
  }, [assets]);

  // Update prices with 24h change from ticker data when available
  useEffect(() => {
    if (ticker && selectedAsset) {
      setPrices((prev) => {
        const next = new Map(prev);
        next.set(selectedAsset, {
          price: ticker.price,
          change24h: ticker.priceChangePercent,
        });
        return next;
      });
    }
  }, [ticker, selectedAsset]);

  const addAsset = useCallback(() => {
    if (!newAsset) return;
    const symbol = newAsset.toUpperCase().replace(/[^A-Z]/g, "");
    if (!symbol || assets.some((a) => a.symbol === symbol)) return;
    setAssets((prev) => [...prev, { symbol, label: symbol.replace("USDT", "/USDT") }]);
    setNewAsset("");
  }, [newAsset, assets]);

  const removeAsset = useCallback((symbol: string) => {
    if (assets.length <= 1) return;
    setAssets((prev) => prev.filter((a) => a.symbol !== symbol));
    if (selectedAsset === symbol) {
      setSelectedAsset(assets.find((a) => a.symbol !== symbol)?.symbol || "BTCUSDT");
    }
  }, [assets, selectedAsset]);

  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[200px]" />
        <div className="absolute bottom-1/3 right-0 w-[500px] h-[500px] bg-[hsl(var(--neon-green))]/5 rounded-full blur-[180px]" />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-accent/4 rounded-full blur-[160px]" />
      </div>

      <AppNavBar />

      <main className="relative z-10 pt-20 pb-20 px-4">
        <div className="max-w-[1600px] mx-auto space-y-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--neon-green))] flex items-center justify-center">
                  <Radio className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-foreground tracking-tight">Live Trade</h1>
                  <p className="text-xs text-muted-foreground">Terminal de trading ao vivo 24/7 • Assistido por IA</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${wsConnected ? "bg-[hsl(var(--neon-green))] animate-pulse" : "bg-[hsl(var(--neon-red))]"}`} />
              <span className="text-xs text-muted-foreground">
                {wsConnected ? "Conectado" : "Desconectado"}
              </span>
            </div>
          </motion.div>

          {/* Multi-Asset Ticker */}
          <MultiAssetTicker
            assets={assets}
            selectedAsset={selectedAsset}
            onSelectAsset={setSelectedAsset}
            prices={prices}
          />

          {/* Add Asset Row */}
          <div className="flex items-center gap-2 max-w-xs">
            <Input
              value={newAsset}
              onChange={(e) => setNewAsset(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
              placeholder="ex: DOGEUSDT"
              className="bg-muted/20 border-border/50 text-xs font-mono h-8"
              onKeyDown={(e) => e.key === "Enter" && addAsset()}
            />
            <Button variant="outline" size="sm" onClick={addAsset} className="h-8 text-xs gap-1 border-primary/30 text-primary">
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>

          {/* Live Ticker */}
          <LiveTicker
            ticker={ticker}
            connected={wsConnected}
            priceDirection={priceDirection}
            asset={selectedAsset.replace("USDT", "/USDT")}
          />

          {/* Main Grid: Chart + Order Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Chart + Depth */}
            <div className="lg:col-span-2 space-y-4">
              <div className="glass-card rounded-2xl p-5 border border-border/20 flex flex-col items-center justify-center" style={{ height: 420 }}>
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground mb-1">
                    {selectedAsset.replace("USDT", "/USDT")} • 15m
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">Gráfico em tempo real</p>
                  {ticker && (
                    <div className="text-4xl font-black font-mono text-foreground">
                      ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-4">
                    Integre com TradingView para gráficos avançados
                  </p>
                </div>
              </div>
              <DepthChart orderBook={orderBook} connected={bookConnected} />
            </div>

            {/* Order Panel + AI */}
            <div className="space-y-4">
              <OrderPanel
                selectedAsset={selectedAsset}
                currentPrice={ticker?.price || 0}
                aiSignal={aiSignal}
                isConnected={isConnected}
                accountBalance={accountBalance}
                onOrderPlaced={fetchPositions}
              />
              <AIAssistant
                aiSignal={aiSignal}
                onRefresh={refreshAI}
                asset={selectedAsset}
              />
            </div>
          </div>

          {/* Positions + History */}
          <LivePositionsPanel
            positions={positions}
            isConnected={isConnected}
            onPositionClosed={fetchPositions}
          />
          <TradeHistory />
        </div>
      </main>
    </div>
  );
}
