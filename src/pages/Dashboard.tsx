import { useState, useCallback, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppNavBar from "@/components/AppNavBar";
import AssetSearch from "@/components/dashboard/AssetSearch";
import AnalysisProcessing from "@/components/dashboard/AnalysisProcessing";
import AnalysisResults from "@/components/dashboard/AnalysisResults";
import LiveTicker from "@/components/dashboard/LiveTicker";
import TriggerAlert from "@/components/dashboard/TriggerAlert";
import { analyzeAsset, type AnalysisResult, type LiveContext } from "@/lib/analyze";
import { saveAnalysisToHistory } from "@/lib/saveAnalysis";
import { useBinanceSocket, toBinanceSymbol } from "@/hooks/useBinanceSocket";
import { useAITrigger } from "@/hooks/useAITrigger";
import { useToast } from "@/hooks/use-toast";

type Stage = "search" | "processing" | "results";

const Dashboard = () => {
  const [stage, setStage] = useState<Stage>("search");
  const [selectedAsset, setSelectedAsset] = useState("");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1H");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  // Dynamic symbol mapping — works for ANY crypto pair
  const binanceSymbol = toBinanceSymbol(selectedAsset);
  const isCrypto = !!binanceSymbol;
  const TIMEFRAME_TO_BINANCE: Record<string, string> = {
    "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1H": "1h", "4H": "4h", "1D": "1d", "1W": "1w",
  };
  const klineInterval = TIMEFRAME_TO_BINANCE[selectedTimeframe] || "1m";
  const { ticker, lastKline, connected, connectionStatus, priceDirection } = useBinanceSocket({
    symbol: binanceSymbol || "btcusdt",
    enabled: isCrypto && stage === "results",
    klineInterval,
  });

  // Extract order block zones from result for trigger engine
  const orderBlockZones = useMemo(() => {
    if (!result?.smc_analysis?.order_blocks) return [];
    return result.smc_analysis.order_blocks.map((ob) => {
      const [low, high] = ob.price_zone.split("-").map(Number);
      return { low: low || 0, high: high || 0 };
    }).filter(z => z.low > 0 && z.high > 0);
  }, [result]);

  const liquidityLevels = useMemo(() => {
    if (!result?.smc_analysis?.liquidity_zones) return [];
    return result.smc_analysis.liquidity_zones.map(z => z.price);
  }, [result]);

  // AI Trigger engine
  const handleTrigger = useCallback(
    async (reason: string) => {
      console.log(`[TRIGGER] ${reason} fired for ${selectedAsset}`);
      if (stage === "results" && selectedAsset) {
        toast({
          title: "🚨 Recalculando...",
          description: `Evento detectado: ${reason}. Atualizando análise com urgência.`,
        });
        try {
          const liveCtx: LiveContext = {
            triggerReason: reason as LiveContext["triggerReason"],
            livePrice: ticker?.price,
            previousSignal: result?.header?.signal,
          };

          if (reason === "volume_anomaly" && lastKline) {
            const avgVol = result?._candles?.slice(-20).reduce((a, c) => a + (c.volume || 0), 0);
            if (avgVol && avgVol > 0) {
              liveCtx.volumeMultiple = (lastKline.volume / (avgVol / 20));
            }
          }

          const data = await analyzeAsset(selectedAsset, selectedTimeframe, liveCtx);
          setResult(data);
        } catch (err: unknown) {
          console.error("Auto-reanalysis failed:", err);
        }
      }
    },
    [selectedAsset, selectedTimeframe, stage, toast, ticker, result, lastKline]
  );

  const { state: triggerState, processKline, processTicker } = useAITrigger({
    onTrigger: handleTrigger,
    cooldownMs: 120000,
    orderBlockZones,
    resistanceLevels: liquidityLevels,
  });

  useEffect(() => {
    if (lastKline && stage === "results") processKline(lastKline);
  }, [lastKline, processKline, stage]);

  useEffect(() => {
    if (ticker && stage === "results") processTicker(ticker);
  }, [ticker, processTicker, stage]);

  const handleAnalyze = async (asset: string, timeframe: string) => {
    setSelectedAsset(asset);
    setSelectedTimeframe(timeframe);
    setStage("processing");

    try {
      const data = await analyzeAsset(asset, timeframe);
      setResult(data);
      setStage("results");
      saveAnalysisToHistory(data).catch(() => {});
    } catch (err: unknown) {
      toast({
        title: "Erro na Análise",
        description: err instanceof Error ? err.message : "Não foi possível analisar o ativo. Tente novamente.",
        variant: "destructive",
      });
      setStage("search");
    }
  };

  const handleNewAnalysis = () => {
    setStage("search");
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[200px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/8 rounded-full blur-[180px]" />
      </div>

      <AppNavBar />
      {stage !== "search" && (
        <div className="fixed top-14 left-0 right-0 z-40 glass-strong border-b border-border/20">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <Button variant="ghost" size="sm" onClick={handleNewAnalysis} className="text-muted-foreground gap-1">
              <ArrowLeft className="w-4 h-4" /> Nova Análise
            </Button>
          </div>
        </div>
      )}

      <main className="relative z-10 pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto space-y-4">
          {stage === "search" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <AssetSearch onAnalyze={handleAnalyze} />
            </motion.div>
          )}
          {stage === "processing" && (
            <AnalysisProcessing asset={selectedAsset} timeframe={selectedTimeframe} />
          )}
          {stage === "results" && result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="space-y-4">
              {isCrypto && (
                <LiveTicker
                  ticker={ticker}
                  connected={connected}
                  priceDirection={priceDirection}
                  asset={selectedAsset}
                />
              )}

              <TriggerAlert
                triggered={triggerState.triggered}
                message={triggerState.message}
              />

              <AnalysisResults
                data={result}
                onNewAnalysis={handleNewAnalysis}
                livePrice={isCrypto && ticker ? ticker.price : undefined}
                livePriceDirection={priceDirection}
                connectionStatus={isCrypto ? connectionStatus : undefined}
              />
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
