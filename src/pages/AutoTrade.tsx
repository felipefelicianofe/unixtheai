import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { X, Plus, Target } from "lucide-react";
import AppNavBar from "@/components/AppNavBar";
import ApiVault from "@/components/autotrade/ApiVault";
import RiskManagement from "@/components/autotrade/RiskManagement";
import LivePositions from "@/components/autotrade/LivePositions";
import LiquidityRadar from "@/components/autotrade/LiquidityRadar";
import MacroShieldWidget from "@/components/autotrade/MacroShield";
import PanicButton from "@/components/autotrade/PanicButton";
import TradingStatusBar from "@/components/autotrade/TradingStatusBar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { runAutotradeEngine } from "@/lib/binanceApi";
import type { ConnectionStatus } from "@/lib/tradingEngine";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const AUTOTRADE_INTERVAL_MS = 5 * 60 * 1000; // Run analysis every 5 minutes

const AutoTrade = () => {
  const [autotradeAssets, setAutotradeAssets] = useState<string[]>(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
  const [newAssetInput, setNewAssetInput] = useState("");
  const [hasPositions, setHasPositions] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAutopilotActive, setIsAutopilotActive] = useState(false);
  const [accountBalance, setAccountBalance] = useState(0);
  const [currentPnl, setCurrentPnl] = useState(0);
  const [lastEngineRun, setLastEngineRun] = useState<string | null>(null);
  const [isEngineOnline, setIsEngineOnline] = useState(false);
  const { user } = useAuth();

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

  // Carrega configurações iniciais (ativos e status do motor 24/7)
  useEffect(() => {
    const loadState = async () => {
      if (!user) return;
      
      const { data: dbSettings } = await (supabase as any)
        .from("autopilot_settings")
        .select("target_assets")
        .eq("user_id", user.id)
        .maybeSingle();

      if (dbSettings && dbSettings.target_assets) {
        setAutotradeAssets(dbSettings.target_assets as string[]);
      }

      const { data: heartbeat } = await (supabase as any)
        .from("system_heartbeats")
        .select("last_pulse_at")
        .eq("caller_name", "autotrade-engine")
        .maybeSingle();

      if (heartbeat) {
        const pulseDate = new Date(heartbeat.last_pulse_at);
        setLastEngineRun(pulseDate.toLocaleTimeString());
        
        // Se a engine bateu nos últimos 6 minutos, consideramos ONLINE (intervalo base é 5m)
        const diffMinutes = (Date.now() - pulseDate.getTime()) / 60000;
        setIsEngineOnline(diffMinutes <= 6);
      }
    };
    
    loadState();
    
    // Configura o Poll passivo do frontend apenas para atualizar UI do Heartbeat
    const uiPoll = setInterval(loadState, 30000);
    return () => clearInterval(uiPoll);
  }, [user]);

  // Função para adicionar ou remover ativos e salvar direto no BD
  const updateAssets = async (newAssetList: string[]) => {
    setAutotradeAssets(newAssetList);
    if (!user) return;
    try {
      await (supabase as any)
        .from("autopilot_settings")
        .update({ target_assets: newAssetList })
        .eq("user_id", user.id);
    } catch {
       // ignorar
    }
  };

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
              Motor de trading IA executando em Cloud 24/7 (Pg_Cron)
              {isEngineOnline ? (
                <span className="text-xs font-bold text-primary ml-2 animate-pulse">• STATUS ONLINE</span>
              ) : (
                <span className="text-xs font-bold text-[hsl(var(--neon-red))] ml-2">• POSSÍVEL PARADA (Revisão da Automação)</span>
              )}
              {lastEngineRun && (
                <span className="text-xs text-muted-foreground ml-2">(Último giro nativo: {lastEngineRun})</span>
              )}
            </p>
          </motion.div>

          <TradingStatusBar
            isConnected={isConnected}
            isAutopilotActive={isAutopilotActive}
            hasPositions={hasPositions}
          />

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6 border-[hsl(var(--neon-green))]/20 shadow-[0_0_30px_rgba(16,185,129,0.05)] bg-gradient-to-b from-background/80 to-background/40">
            <h2 className="text-sm font-bold flex items-center gap-2 text-foreground mb-4">
              <Target className="w-5 h-5 text-primary" />
              Esquadrão Institucional Múltiplo (Scanner Dinâmico)
            </h2>
            <div className="flex flex-wrap gap-2 mb-5">
              <AnimatePresence>
                {autotradeAssets.map((asset) => (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    key={asset} 
                    className="flex items-center gap-2 bg-[hsl(var(--neon-green))]/10 text-[hsl(var(--neon-green))] px-3 py-1.5 rounded-[10px] border border-[hsl(var(--neon-green))]/30 shadow-sm text-sm font-bold font-mono tracking-wide"
                  >
                    {asset}
                    <button
                      onClick={() => updateAssets(autotradeAssets.filter((a) => a !== asset))}
                      disabled={isAutopilotActive}
                      className="hover:text-red-500 transition-colors disabled:opacity-30 disabled:hover:text-inherit"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            <div className="flex gap-3 max-w-sm">
               <Input 
                 value={newAssetInput}
                 onChange={(e) => setNewAssetInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                 placeholder="ex: BNBUSDT"
                 disabled={isAutopilotActive}
                 className="bg-muted/20 border-border/50 focus-visible:ring-primary/50 text-sm font-bold tracking-widest"
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' && newAssetInput) {
                     if (!autotradeAssets.includes(newAssetInput)) {
                       setAutotradeAssets([...autotradeAssets, newAssetInput]);
                     }
                     setNewAssetInput("");
                   }
                 }}
               />
               <Button 
                   disabled={isAutopilotActive || !newAssetInput}
                   onClick={() => {
                     if (newAssetInput && !autotradeAssets.includes(newAssetInput)) {
                       setAutotradeAssets([...autotradeAssets, newAssetInput]);
                       setNewAssetInput("");
                     }
                   }} 
                   variant="outline" 
                   className="border-primary/50 text-primary hover:bg-primary/20 hover:text-primary transition-all font-bold gap-1"
               >
                 <Plus className="w-4 h-4" /> ADD
               </Button>
            </div>
            <p className="text-[10.5px] text-muted-foreground/80 mt-4 leading-relaxed max-w-2xl">
              Os Ativos blindados acima são passados em tempo real para as Edge Functions Supabase em forma de Array. O AutoTrade aplicará Wyckoff/SMC, simulará 10.000 cenários Monte-Carlo e buscará Setup Ótimo. Desative o Autopilot para editar os satélites.
            </p>
          </motion.div>

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
