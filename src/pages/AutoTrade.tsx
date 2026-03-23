import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import AppNavBar from "@/components/AppNavBar";
import ApiVault from "@/components/autotrade/ApiVault";
import RiskManagement from "@/components/autotrade/RiskManagement";
import LivePositions from "@/components/autotrade/LivePositions";
import LiquidityRadar from "@/components/autotrade/LiquidityRadar";
import MacroShieldWidget from "@/components/autotrade/MacroShield";
import PanicButton from "@/components/autotrade/PanicButton";
import TradingStatusBar from "@/components/autotrade/TradingStatusBar";
import { runAutotradeEngine } from "@/lib/binanceApi";
import type { ConnectionStatus } from "@/lib/tradingEngine";

const AUTOTRADE_INTERVAL_MS = 5 * 60 * 1000; // Run analysis every 5 minutes
const AUTOTRADE_ASSETS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

const AutoTrade = () => {
  const [hasPositions, setHasPositions] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAutopilotActive, setIsAutopilotActive] = useState(false);
  const [accountBalance, setAccountBalance] = useState(0);
  const [currentPnl, setCurrentPnl] = useState(0);
  const [lastEngineRun, setLastEngineRun] = useState<string | null>(null);
  const engineRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handlePanicClose = useCallback(() => {
    setHasPositions(false);
  }, []);

  const handleConnectionChange = useCallback((status: ConnectionStatus | null) => {
    setIsConnected(!!status?.connected);
    if (status) {
      setAccountBalance(status.accountBalance);
      setCurrentPnl(status.totalPnl);
    } else {
      setAccountBalance(0);
      setCurrentPnl(0);
    }
  }, []);

  const handleAutopilotChange = useCallback((active: boolean) => {
    setIsAutopilotActive(active);
  }, []);

  const handlePositionsChange = useCallback((has: boolean) => {
    setHasPositions(has);
  }, []);

  // AutoTrade Engine Loop
  const runEngine = useCallback(async () => {
    if (!isConnected || !isAutopilotActive) return;

    console.log("[AUTOTRADE UI] Running engine cycle...");
    try {
      const result = await runAutotradeEngine(AUTOTRADE_ASSETS, "1h");
      setLastEngineRun(new Date().toLocaleTimeString());

      interface AutotradeResult {
        executed: boolean;
        asset: string;
        side?: string;
        quantity?: number;
        stopLoss?: number;
        takeProfit?: number;
        reason?: string;
        confidence?: number;
      }

      const res = result as { results?: AutotradeResult[]; autopilot_deactivated?: boolean; reason?: string };
      
      if (res && res.autopilot_deactivated) {
        setIsAutopilotActive(false);
        toast.warning(res.reason || "Autopilot deactivated by kill switch");
        return;
      }

      const executed = res?.results?.filter((r) => r.executed) || [];
      if (executed.length > 0) {
        for (const exec of executed) {
          toast.success(
            `🎯 Ordem executada: ${exec.side} ${exec.quantity} ${exec.asset} @ market | SL: $${exec.stopLoss} | TP: $${exec.takeProfit}`,
            { duration: 10000 }
          );
        }
      }

      const skipped = res?.results?.filter((r) => !r.executed) || [];
      for (const skip of skipped) {
        if (skip.confidence && skip.confidence > 50) {
          console.log(`[AUTOTRADE] ${skip.asset}: ${skip.reason}`);
        }
      }
    } catch (err) {
      console.error("[AUTOTRADE] Engine error:", err);
    }
  }, [isConnected, isAutopilotActive]);

  // Start/stop engine loop
  useEffect(() => {
    if (engineRef.current) {
      clearInterval(engineRef.current);
      engineRef.current = null;
    }

    if (isConnected && isAutopilotActive) {
      // Run immediately on activation
      runEngine();
      // Then run periodically
      engineRef.current = setInterval(runEngine, AUTOTRADE_INTERVAL_MS);
    }

    return () => {
      if (engineRef.current) clearInterval(engineRef.current);
    };
  }, [isConnected, isAutopilotActive, runEngine]);

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[200px]" />
        <div className="absolute bottom-1/4 left-0 w-[500px] h-[500px] bg-accent/6 rounded-full blur-[180px]" />
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-[hsl(var(--neon-green))]/4 rounded-full blur-[160px]" />
      </div>

      <AppNavBar />

      <main className="relative z-10 pt-24 pb-24 px-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
            <h1 className="text-2xl font-bold text-foreground">Painel de Execução Autônoma</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Motor de trading IA com dados e execução reais via Binance Futures
              {lastEngineRun && (
                <span className="text-xs text-primary ml-2">(Última análise: {lastEngineRun})</span>
              )}
            </p>
          </motion.div>

          <TradingStatusBar
            isConnected={isConnected}
            isAutopilotActive={isAutopilotActive}
            hasPositions={hasPositions}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ApiVault onConnectionChange={handleConnectionChange} />
            <RiskManagement
              accountBalance={accountBalance}
              currentPnl={currentPnl}
              onAutopilotChange={handleAutopilotChange}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MacroShieldWidget />
            <LiquidityRadar />
          </div>

          <LivePositions
            isConnected={isConnected}
            onPositionsChange={handlePositionsChange}
          />
        </div>
      </main>

      <PanicButton hasPositions={hasPositions} onPanicClose={handlePanicClose} />
    </div>
  );
};

export default AutoTrade;
