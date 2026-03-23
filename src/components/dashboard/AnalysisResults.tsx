import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Minus, Shield, Target, Brain, BarChart3,
  Activity, Zap, Copy, RefreshCw, AlertTriangle, Clock, Newspaper,
  ArrowUpRight, CheckCircle2, XCircle, Database, Info, Gauge, Calculator,
  Globe, Flame, Timer, BarChart2, ChevronDown, Sparkles, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { AnalysisResult } from "@/lib/analyze";
import TradingChart from "./TradingChart";
import TradingHeatmap from "./TradingHeatmap";

const verdictConfig = {
  CONFIRMED: { icon: CheckCircle2, label: "Confirmado pelo Agente Mestre", bg: "bg-[hsl(var(--neon-green))]/10", border: "border-[hsl(var(--neon-green))]/30", text: "text-[hsl(var(--neon-green))]" },
  DOWNGRADED: { icon: AlertTriangle, label: "Sinal Rebaixado", bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" },
  OVERRIDDEN_TO_NEUTRAL: { icon: Shield, label: "Sobrescrito para NEUTRO", bg: "bg-[hsl(var(--neon-red))]/10", border: "border-[hsl(var(--neon-red))]/30", text: "text-[hsl(var(--neon-red))]" },
  FLAGGED: { icon: AlertTriangle, label: "Sinal com Ressalvas", bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" },
} as const;

const MasterAgentBadge = ({ master }: { master: NonNullable<AnalysisResult["_master"]> }) => {
  const cfg = verdictConfig[master.verdict] || verdictConfig.FLAGGED;
  const Icon = cfg.icon;
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className={`rounded-xl ${cfg.bg} border ${cfg.border} overflow-hidden`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${cfg.text}`} />
          <span className={`text-sm font-bold ${cfg.text}`}>{cfg.label}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} font-mono`}>
            Q:{master.quality_score}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {Math.round(master.subsystem_agreement * 100)}% concordância
          </span>
        </div>
        <div className="flex items-center gap-2">
          {master.original_signal !== "NEUTRO" && master.verdict !== "CONFIRMED" && (
            <span className="text-[10px] text-muted-foreground">
              Original: {master.original_signal} {master.original_confidence}%
            </span>
          )}
          <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>
      {expanded && (master.adjustments.length > 0 || master.warnings.length > 0) && (
        <div className="px-4 pb-3 space-y-1 border-t border-border/20 pt-2">
          {master.adjustments.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="text-amber-400 mt-0.5">↳</span> {a}
            </div>
          ))}
          {master.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-[hsl(var(--neon-red))]/80">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import type { ConnectionStatus } from "@/hooks/useBinanceSocket";

interface Props {
  data: AnalysisResult;
  onNewAnalysis: () => void;
  livePrice?: number;
  livePriceDirection?: "up" | "down" | null;
  connectionStatus?: ConnectionStatus;
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const SignalBadge = ({ signal }: { signal: string }) => {
  const config: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    COMPRA: { bg: "bg-[hsl(var(--neon-green))]/20", text: "text-[hsl(var(--neon-green))]", icon: TrendingUp },
    VENDA: { bg: "bg-[hsl(var(--neon-red))]/20", text: "text-[hsl(var(--neon-red))]", icon: TrendingDown },
    NEUTRO: { bg: "bg-muted/30", text: "text-muted-foreground", icon: Minus },
  };
  const c = config[signal] || config.NEUTRO;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold ${c.bg} ${c.text}`}>
      <Icon className="w-4 h-4" /> {signal}
    </span>
  );
};

const MetricCard = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) => (
  <div className="glass rounded-xl p-4">
    <div className="text-xs text-muted-foreground mb-1">{label}</div>
    <div className={`text-lg font-bold ${color || "text-foreground"}`}>{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
  </div>
);

const AIBadge = () => (
  <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-accent/20 text-accent ml-2">
    <Brain className="w-3 h-3" /> IA Interpretativa
  </span>
);

/** Dynamic price formatting: adapts decimal places based on price magnitude */
function formatLivePrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
  if (price >= 0.001) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })}`;
  return `$${price.toLocaleString(undefined, { minimumFractionDigits: 8, maximumFractionDigits: 8 })}`;
}

const AnalysisResults = ({ data, onNewAnalysis, livePrice, livePriceDirection, connectionStatus }: Props) => {
  const { toast } = useToast();
  const [localData, setLocalData] = useState(data);
  
  useEffect(() => { setLocalData(data); }, [data]);

  const { header, risk_management: rm, technical_indicators: ti, smc_analysis: smc, wegd_analysis: wegd, quantitative: quant, sentiment, institutional_synthesis: synthesis } = localData;

  // AI on-demand state
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const isDefaultSummary = wegd.wyckoff_phase === "N/A" || synthesis.executive_summary?.includes("motor determinístico");

  const handleGenerateAI = useCallback(async (section: "executive_summary" | "wegd" | "master_audit") => {
    setAiLoading(prev => ({ ...prev, [section]: true }));
    try {
      const { data: aiResult, error } = await supabase.functions.invoke("generate-ai-narrative", {
        body: { analysisData: localData, sections: [section] },
      });
      if (error) throw new Error(error.message);
      if (!aiResult) throw new Error("Empty response");

      setLocalData(prev => {
        const updated = { ...prev };
        if (section === "wegd" && aiResult.wegd_analysis) {
          updated.wegd_analysis = aiResult.wegd_analysis;
        }
        if (section === "executive_summary") {
          updated.institutional_synthesis = {
            ...updated.institutional_synthesis,
            executive_summary: aiResult.executive_summary || updated.institutional_synthesis.executive_summary,
            warning: aiResult.warning || updated.institutional_synthesis.warning,
            best_hours: aiResult.best_hours || updated.institutional_synthesis.best_hours,
          };
        }
        return updated;
      });
      toast({ title: "✅ Narrativa gerada com sucesso!" });
    } catch (err: unknown) {
      toast({ title: "Erro ao gerar narrativa", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setAiLoading(prev => ({ ...prev, [section]: false }));
    }
  }, [localData, toast]);

  // Typing effect for executive summary
  const [typedSummary, setTypedSummary] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!synthesis?.executive_summary) return;
    setTypedSummary("");
    setIsTyping(true);
    let i = 0;
    const text = synthesis.executive_summary;
    const interval = setInterval(() => {
      if (i < text.length) {
        setTypedSummary(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, text.length > 500 ? 5 : 12);
    return () => clearInterval(interval);
  }, [synthesis?.executive_summary]);

  const isCompra = header.signal === "COMPRA";
  const signalColor = isCompra ? "text-[hsl(var(--neon-green))]" : header.signal === "VENDA" ? "text-[hsl(var(--neon-red))]" : "text-muted-foreground";
  const hasRealData = data._has_real_data;
  const hasRealVolume = data._has_real_volume;
  const dataSource = data._data_source || "unknown";
  const dataWarnings = data._data_warnings || [];
  const candles = data._candles || [];
  const harmonicPatterns = data._harmonic_patterns || [];
  const dualScenarios = data._dual_scenarios;
  const extendedMonteCarlo = data._monte_carlo_extended;
  const smcStatus = data._smc_status;
  const analysisTimestampLabel = data._analysis_timestamp
    ? new Date(data._analysis_timestamp).toLocaleString("pt-BR", { hour12: false })
    : null;

  // Dynamic trailing stop logic
  const displayPrice = livePrice || rm.entry_price;
  const entryPrice = rm.entry_price;
  const priceMovePct = entryPrice > 0 ? ((displayPrice - entryPrice) / entryPrice) * 100 : 0;
  const isInFavor = isCompra ? priceMovePct > 0 : priceMovePct < 0;
  const absMovePct = Math.abs(priceMovePct);

  // Trailing stop: if price moves 2%+ in our favor, move SL to breakeven
  let dynamicStopLoss = rm.stop_loss;
  let stopMoved = false;
  if (isInFavor && absMovePct >= 2) {
    dynamicStopLoss = entryPrice; // Breakeven
    stopMoved = true;
  }

  const copySignals = () => {
    const text = `📊 ${header.asset} (${header.timeframe})
Sinal: ${header.signal} | Força: ${header.signal_strength_pct}%
Entry: ${rm.entry_price}
Stop Loss: ${rm.stop_loss}
TP1: ${rm.take_profit_1}
TP2: ${rm.take_profit_2}
TP3: ${rm.take_profit_3}
R:R: ${rm.risk_reward_ratio}
Confiança: ${header.final_confidence_pct}%
Fonte: ${dataSource}
— Katon AI`;
    navigator.clipboard.writeText(text);
    toast({ title: "Sinais copiados!", description: "Cole na sua corretora ou grupo." });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeUp} className="glass rounded-2xl p-6 neon-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative group p-1">
              {/* Asset Pulse Background */}
              <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className={`absolute inset-0 rounded-full blur-xl ${isCompra ? "bg-[hsl(var(--neon-green))]" : "bg-[hsl(var(--neon-red))]"}`}
              />
              <div className={`relative px-4 py-2 rounded-xl glass border-2 ${isCompra ? "border-[hsl(var(--neon-green))]/40" : "border-[hsl(var(--neon-red))]/40"} flex flex-col items-center`}>
                <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-0.5">Asset</span>
                <h1 className="text-3xl font-black text-foreground tracking-tighter">{header.asset}</h1>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1.5 pt-1">
                <SignalBadge signal={header.signal} />
                {hasRealVolume && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-black uppercase tracking-widest animate-pulse">
                    <Flame className="w-3 h-3" /> Hype
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                <Clock className="w-3 h-3" /> {header.timeframe} 
                <span className="opacity-30">•</span> 
                <Timer className="w-3 h-3" /> {analysisTimestampLabel ? analysisTimestampLabel : "Recém-gerado"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={copySignals} variant="outline" className="gap-2 border-white/5 bg-white/5 hover:bg-white/10 transition-all shadow-lg group">
              <Copy className="w-4 h-4 transition-transform group-hover:scale-110" /> 
              <span className="hidden sm:inline">Copiar Sinais</span>
            </Button>
            <Button onClick={onNewAnalysis} variant="secondary" className="gap-2 shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/10 group">
              <RefreshCw className="w-4 h-4 transition-transform group-hover:rotate-180 duration-500" />
              <span className="hidden sm:inline">Nova Análise</span>
            </Button>
          </div>
        </div>

        {/* Strength meters */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Força do Sinal</span>
              <span className={`font-bold ${signalColor}`}>{header.signal_strength_pct}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${isCompra ? "bg-[hsl(var(--neon-green))]" : "bg-[hsl(var(--neon-red))]"}`} style={{ width: `${header.signal_strength_pct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Confiança Final</span>
              <span className="font-bold text-primary">{header.final_confidence_pct}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${header.final_confidence_pct}%` }} />
            </div>
          </div>
        </div>

        {/* Data Source Badge */}
        {hasRealData ? (
          <div className="flex items-center gap-2 mt-4 bg-[hsl(var(--neon-green))]/10 rounded-lg px-3 py-2 border border-[hsl(var(--neon-green))]/20">
            <CheckCircle2 className="w-4 h-4 text-[hsl(var(--neon-green))]" />
            <span className="text-xs text-[hsl(var(--neon-green))] font-medium">
              Dados Reais — Indicadores calculados matematicamente via TA Engine
            </span>
            <Database className="w-3 h-3 text-[hsl(var(--neon-green))]/70 ml-auto" />
            <span className="text-[10px] text-[hsl(var(--neon-green))]/70">{dataSource}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-4 bg-[hsl(var(--neon-red))]/10 rounded-lg px-3 py-2 border border-[hsl(var(--neon-red))]/20">
            <XCircle className="w-4 h-4 text-[hsl(var(--neon-red))]" />
            <span className="text-xs text-[hsl(var(--neon-red))] font-medium">
              Dados Simulados — Nenhuma fonte de dados real disponível para este ativo
            </span>
          </div>
        )}

        {/* Data warnings */}
        {dataWarnings.length > 0 && hasRealData && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {dataWarnings.includes("forex_no_public_volume") && (
              <span className="text-[10px] text-muted-foreground/60 bg-muted/20 rounded px-2 py-0.5 flex items-center gap-1">
                <Info className="w-3 h-3" /> Forex spot não possui volume público
              </span>
            )}
            {dataWarnings.includes("forex_ohlc_derived_from_close") && (
              <span className="text-[10px] text-muted-foreground/60 bg-muted/20 rounded px-2 py-0.5 flex items-center gap-1">
                <Info className="w-3 h-3" /> OHLC derivado de taxas diárias ECB
              </span>
            )}
          </div>
        )}
      </motion.div>

      {/* Master Agent Verdict */}
      {data._master && (
        <motion.div {...fadeUp} transition={{ delay: 0.03 }}>
          <MasterAgentBadge master={data._master} />
        </motion.div>
      )}

      {/* TradingView Chart */}
      {candles.length > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.05 }}>
          <TradingChart
            candles={candles}
            entryPrice={rm.entry_price}
            stopLoss={rm.stop_loss}
            takeProfit1={rm.take_profit_1}
            takeProfit2={rm.take_profit_2}
            takeProfit3={rm.take_profit_3}
            signal={header.signal}
            hasRealVolume={hasRealVolume}
            timeframe={header.timeframe}
          />
        </motion.div>
      )}

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Entry/Stop/TP Card */}
        <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6 neon-border lg:row-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">Gestão de Risco</h3>
            {hasRealData && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--neon-green))]/20 text-[hsl(var(--neon-green))] ml-auto">ATR Real</span>}
          </div>
          <div className="space-y-4">
            <div className="bg-primary/10 rounded-xl p-4 border border-primary/30">
              <div className="text-xs text-muted-foreground">Preço de Entrada</div>
              <div className="text-xl font-bold text-primary flex items-center gap-1">
                <ArrowUpRight className="w-4 h-4" /> {rm.entry_price?.toLocaleString()}
              </div>
            </div>
            {/* Live Price Display */}
            {livePrice && (
              <div className="bg-foreground/5 rounded-xl p-4 border border-foreground/10 mb-2">
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  Preço Live (Binance)
                  {connectionStatus && (
                    <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-medium ${
                      connectionStatus === "live" ? "bg-[hsl(var(--neon-green))]/15 text-[hsl(var(--neon-green))]" :
                      connectionStatus === "fallback" ? "bg-amber-500/15 text-amber-400" :
                      connectionStatus === "stale" ? "bg-[hsl(var(--neon-red))]/15 text-[hsl(var(--neon-red))]" :
                      connectionStatus === "connecting" ? "bg-primary/15 text-primary" :
                      "bg-muted/30 text-muted-foreground"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        connectionStatus === "live" ? "bg-[hsl(var(--neon-green))] animate-pulse" :
                        connectionStatus === "fallback" ? "bg-amber-400" :
                        connectionStatus === "stale" ? "bg-[hsl(var(--neon-red))]" :
                        connectionStatus === "connecting" ? "bg-primary animate-pulse" :
                        "bg-muted-foreground"
                      }`} />
                      {connectionStatus === "live" ? "Live" :
                        connectionStatus === "fallback" ? "REST" :
                        connectionStatus === "stale" ? "Stale" :
                        connectionStatus === "connecting" ? "Conectando..." :
                        "Offline"}
                    </span>
                  )}
                </div>
                <motion.div
                  key={livePrice}
                  animate={{
                    color: livePriceDirection === "up" ? "hsl(142, 76%, 50%)" : livePriceDirection === "down" ? "hsl(0, 84%, 60%)" : "hsl(210, 40%, 96%)",
                  }}
                  transition={{ duration: 0.3 }}
                  className="text-xl font-bold font-mono"
                >
                  {formatLivePrice(livePrice)}
                </motion.div>
                <div className={`text-xs mt-1 ${isInFavor ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"}`}>
                  {priceMovePct >= 0 ? "+" : ""}{priceMovePct.toFixed(2)}% desde entry
                </div>
              </div>
            )}
            <div className={`rounded-xl p-4 border ${stopMoved ? "bg-primary/10 border-primary/30" : "bg-[hsl(var(--neon-red))]/10 border-[hsl(var(--neon-red))]/30"}`}>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  Stop Loss
                  {stopMoved && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--neon-green))]/20 text-[hsl(var(--neon-green))] ml-1">
                      🔒 Breakeven
                    </span>
                  )}
                </div>
                <div className={`text-xl font-bold flex items-center gap-1 ${stopMoved ? "text-primary" : "text-[hsl(var(--neon-red))]"}`}>
                  <Shield className="w-4 h-4" /> {dynamicStopLoss?.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stopMoved ? "Stop movido para 0x0 (proteção de capital)" : `Risco: ${rm.risk_pct?.toFixed(2)}%`}
                </div>
              </div>
              {[
                { label: "Take Profit 1 (R:R 1:1)", value: rm.take_profit_1 },
                { label: "Take Profit 2 (R:R 1:2)", value: rm.take_profit_2 },
                { label: "Take Profit 3 (R:R 1:3)", value: rm.take_profit_3 },
              ].map((tp) => (
                <div key={tp.label} className="bg-[hsl(var(--neon-green))]/10 rounded-xl p-4 border border-[hsl(var(--neon-green))]/30">
                  <div className="text-xs text-muted-foreground">{tp.label}</div>
                  <div className="text-xl font-bold text-[hsl(var(--neon-green))]">{tp.value?.toLocaleString()}</div>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-2 border-t border-border/30">
                <span className="text-muted-foreground">ATR</span>
                <span className="font-mono text-foreground">{rm.atr_value}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">R:R Ratio</span>
                <span className="font-mono text-primary font-bold">{rm.risk_reward_ratio}</span>
              </div>
          </div>
        </motion.div>

        {/* Technical Indicators */}
        <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">Indicadores Técnicos</h3>
            {hasRealData && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--neon-green))]/20 text-[hsl(var(--neon-green))] ml-auto">Calculado</span>}
          </div>

          {/* RSI Gauge */}
          {ti.rsi && (
            <div className="mb-4 p-3 rounded-xl bg-muted/20 border border-border/30">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-muted-foreground">RSI Gauge (0-100)</span>
                <span className="text-sm font-bold text-foreground">{ti.rsi.value.toFixed(1)}</span>
              </div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: `${Math.max(0, Math.min(100, ti.rsi.value))}%` }} />
                <span className="absolute left-[30%] top-[-10px] text-[9px] text-muted-foreground">30</span>
                <span className="absolute left-[50%] top-[-10px] text-[9px] text-muted-foreground">50</span>
                <span className="absolute left-[70%] top-[-10px] text-[9px] text-muted-foreground">70</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">Leitura: {ti.rsi.signal}</div>
            </div>
          )}

          {/* Confluence Score */}
          {ti.confluence && (
            <div className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted-foreground">Confluência Ponderada</span>
                <span className="text-xs text-muted-foreground">{ti.regime?.regime === "TRENDING" ? "⚡ Trending" : "📊 Ranging"}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden mb-1">
                <div className="h-full rounded-full bg-primary" style={{ width: `${ti.confluence.confidence}%` }} />
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[hsl(var(--neon-green))]">Buy: {ti.confluence.buy_score}/{ti.confluence.max_score}</span>
                <span className="font-bold text-primary">{ti.confluence.confidence?.toFixed(0)}%</span>
                <span className="text-[hsl(var(--neon-red))]">Sell: {ti.confluence.sell_score}/{ti.confluence.max_score}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-2 rounded-lg bg-[hsl(var(--neon-green))]/10">
              <div className="text-lg font-bold text-[hsl(var(--neon-green))]">{ti.buy_signals}</div>
              <div className="text-[10px] text-muted-foreground">Compra</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <div className="text-lg font-bold text-muted-foreground">{ti.neutral_signals}</div>
              <div className="text-[10px] text-muted-foreground">Neutro</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-[hsl(var(--neon-red))]/10">
              <div className="text-lg font-bold text-[hsl(var(--neon-red))]">{ti.sell_signals}</div>
              <div className="text-[10px] text-muted-foreground">Venda</div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {[
              { label: "RSI", value: ti.rsi?.value?.toFixed(2), signal: ti.rsi?.signal },
              { label: "MACD", value: ti.macd?.histogram?.toFixed(4), signal: ti.macd?.signal },
              { label: "ADX", value: ti.adx?.value?.toFixed(2), signal: ti.adx?.trend_strength },
              { label: "VWAP", value: ti.vwap?.toFixed(2), signal: rm.entry_price > (ti.vwap || 0) ? "Acima (Bullish)" : "Abaixo (Bearish)" },
              { label: "MFI", value: ti.mfi?.toFixed(2), signal: !hasRealVolume ? "sem volume" : undefined },
              { label: "CCI", value: ti.cci?.toFixed(2) },
              { label: "Stoch %K/%D", value: `${ti.stochastic?.k?.toFixed(1)}/${ti.stochastic?.d?.toFixed(1)}` },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-center py-1 border-b border-border/20">
                <span className="text-muted-foreground">{row.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-foreground">{row.value}</span>
                  {row.signal && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">{row.signal}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Ichimoku */}
          {ti.ichimoku && (
            <div className="mt-3 pt-3 border-t border-border/20">
              <div className="text-xs text-muted-foreground mb-2">Ichimoku Cloud</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Tenkan</span><span className="font-mono">{ti.ichimoku.tenkan?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Kijun</span><span className="font-mono">{ti.ichimoku.kijun?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Senkou A</span><span className="font-mono">{ti.ichimoku.senkouA?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Senkou B</span><span className="font-mono">{ti.ichimoku.senkouB?.toFixed(2)}</span></div>
              </div>
              <div className={`text-xs font-bold mt-1 ${ti.ichimoku.signal === "BULLISH" ? "text-[hsl(var(--neon-green))]" : ti.ichimoku.signal === "BEARISH" ? "text-[hsl(var(--neon-red))]" : "text-muted-foreground"}`}>
                Sinal: {ti.ichimoku.signal}
              </div>
            </div>
          )}

          {/* Divergences */}
          {ti.divergences && ti.divergences.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/20">
              <div className="text-xs text-muted-foreground mb-2">⚠️ Divergências Detectadas</div>
              {ti.divergences.map((d: { type: string, indicator: string }, i: number) => (
                <div key={i} className={`text-xs p-2 rounded-lg mb-1 ${d.type === "BULLISH" ? "bg-[hsl(var(--neon-green))]/10 text-[hsl(var(--neon-green))]" : "bg-[hsl(var(--neon-red))]/10 text-[hsl(var(--neon-red))]"}`}>
                  {d.type} Divergência no {d.indicator}
                </div>
              ))}
            </div>
          )}

          {/* Candle Patterns */}
          {ti.candle_patterns && ti.candle_patterns.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/20">
              <div className="text-xs text-muted-foreground mb-2">Padrões de Candle</div>
              <div className="flex flex-wrap gap-1">
                {ti.candle_patterns.map((p: { type: string, name: string }, i: number) => (
                  <span key={i} className={`text-[10px] px-2 py-0.5 rounded ${p.type === "BULLISH" ? "bg-[hsl(var(--neon-green))]/15 text-[hsl(var(--neon-green))]" : "bg-[hsl(var(--neon-red))]/15 text-[hsl(var(--neon-red))]"}`}>
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Pivot Points */}
          {ti.pivot_points && (
            <div className="mt-3 pt-3 border-t border-border/20">
              <div className="text-xs text-muted-foreground mb-2">Pivot Points (Clássico)</div>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                <div className="text-center p-1 rounded bg-[hsl(var(--neon-red))]/10">
                  <div className="text-muted-foreground">R2</div>
                  <div className="font-mono text-[hsl(var(--neon-red))]">{ti.pivot_points.classic?.r2?.toFixed(0)}</div>
                </div>
                <div className="text-center p-1 rounded bg-[hsl(var(--neon-red))]/10">
                  <div className="text-muted-foreground">R1</div>
                  <div className="font-mono text-[hsl(var(--neon-red))]">{ti.pivot_points.classic?.r1?.toFixed(0)}</div>
                </div>
                <div className="text-center p-1 rounded bg-[hsl(var(--neon-green))]/10">
                  <div className="text-muted-foreground">S1</div>
                  <div className="font-mono text-[hsl(var(--neon-green))]">{ti.pivot_points.classic?.s1?.toFixed(0)}</div>
                </div>
                <div className="text-center p-1 rounded bg-[hsl(var(--neon-green))]/10">
                  <div className="text-muted-foreground">S2</div>
                  <div className="font-mono text-[hsl(var(--neon-green))]">{ti.pivot_points.classic?.s2?.toFixed(0)}</div>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* SMC */}
        <motion.div {...fadeUp} transition={{ delay: 0.3 }} className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-foreground">Smart Money Concepts</h3>
            {hasRealData && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--neon-green))]/20 text-[hsl(var(--neon-green))] ml-auto">Algorítmico</span>}
          </div>
          <div className="space-y-3">
            <div className="text-[10px] text-muted-foreground bg-muted/20 rounded-lg px-2 py-1 border border-border/30">
              SMC = leitura de liquidez institucional (Order Blocks, FVG e quebra de estrutura).
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Viés</span>
              <span className={`font-bold ${smc.bias === "BULLISH" ? "text-[hsl(var(--neon-green))]" : smc.bias === "BEARISH" ? "text-[hsl(var(--neon-red))]" : "text-muted-foreground"}`}>
                {smc.bias}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Break of Structure</span>
              <span className="font-mono text-foreground text-xs">{smc.break_of_structure}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">Order Blocks</div>
            {smc.order_blocks?.map((ob, i) => {
              const status = smcStatus?.order_blocks?.find((s) => s.type === ob.type && s.price_zone === ob.price_zone)?.status;
              return (
                <div key={i} className="text-xs flex justify-between bg-muted/20 rounded-lg p-2 gap-2">
                  <span className={ob.type === "DEMAND" ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"}>{ob.type}</span>
                  <span className="text-muted-foreground">{ob.price_zone}</span>
                  <span className="text-foreground">{ob.strength}</span>
                  {status && (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${status === "ACTIVE" ? "bg-primary/20 text-primary" : "bg-muted/40 text-muted-foreground"}`}>
                      {status}
                    </span>
                  )}
                </div>
              );
            })}
            <div className="text-xs text-muted-foreground mt-2">FVGs</div>
            {smc.fair_value_gaps?.map((fvg, i) => {
              const status = smcStatus?.fair_value_gaps?.find((s) => s.direction === fvg.direction && s.zone === fvg.zone)?.status;
              return (
                <div key={i} className="text-xs flex justify-between bg-muted/20 rounded-lg p-2 gap-2">
                  <span className={fvg.direction === "BULLISH" ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"}>{fvg.direction}</span>
                  <span className="text-muted-foreground">{fvg.zone}</span>
                  {status && (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${status === "ACTIVE" ? "bg-primary/20 text-primary" : "bg-muted/40 text-muted-foreground"}`}>
                      {status}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Harmonics + Dual Scenario */}
        <motion.div {...fadeUp} transition={{ delay: 0.35 }} className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">Cenários Institucionais</h3>
          </div>

          {harmonicPatterns.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-muted-foreground mb-2">Padrões Harmônicos (PRZ)</div>
              <div className="space-y-2">
                {harmonicPatterns.map((pattern, idx) => (
                  <div key={`${pattern.pattern}-${idx}`} className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{pattern.pattern}</span>
                      <span className="text-muted-foreground">{pattern.direction}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-muted-foreground">
                      <span>PRZ: {pattern.prz}</span>
                      <span>Comp: {pattern.completion_pct}% • Conf: {pattern.confidence_pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dualScenarios && (
            <div>
              <div className="text-xs text-muted-foreground mb-2">Probabilidade Dual (compra x venda)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: "BUY", label: "Compra", scenario: dualScenarios.buy },
                  { key: "SELL", label: "Venda", scenario: dualScenarios.sell },
                ].map((item) => (
                  <div key={item.key} className="rounded-lg border border-border/30 bg-muted/20 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{item.label}</span>
                      <span className="text-primary">{item.scenario.probability_pct}%</span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Entry</span><span className="font-mono">{item.scenario.entry.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">SL</span><span className="font-mono">{item.scenario.stop_loss.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">TP1</span><span className="font-mono">{item.scenario.take_profit_1.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">TP2</span><span className="font-mono">{item.scenario.take_profit_2.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">TP3</span><span className="font-mono">{item.scenario.take_profit_3.toFixed(2)}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* WEGD */}
        <motion.div {...fadeUp} transition={{ delay: 0.4 }} className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">WEGD Analysis</h3>
            {wegd.wyckoff_phase !== "N/A" && <AIBadge />}
          </div>
          <div className="text-[10px] text-muted-foreground bg-muted/20 rounded-lg px-2 py-1 border border-border/30 mb-3">
            WEGD combina Wyckoff, Elliott, Gann e Dow para validar contexto estrutural.
          </div>
          {wegd.wyckoff_phase === "N/A" ? (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground mb-3">Interpretação WEGD disponível via IA on-demand</p>
              <Button
                onClick={() => handleGenerateAI("wegd")}
                disabled={aiLoading.wegd}
                size="sm"
                variant="outline"
                className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
              >
                {aiLoading.wegd ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiLoading.wegd ? "Gerando..." : "🤖 Gerar com IA"}
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Wyckoff" value={wegd.wyckoff_phase} />
                <MetricCard label="Elliott" value={wegd.elliott_wave} />
                <MetricCard label="Gann" value={wegd.gann_angle} />
                <MetricCard label="Dow" value={wegd.dow_theory} />
              </div>
              <div className="mt-4 text-center">
                <div className="text-xs text-muted-foreground">Confluência WEGD</div>
                <div className="text-2xl font-bold text-primary">{wegd.confluence_score}</div>
              </div>
            </>
          )}
        </motion.div>

        {/* Quantitative */}
        <motion.div {...fadeUp} transition={{ delay: 0.5 }} className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-foreground">Modelo Quantitativo</h3>
            {hasRealData && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--neon-green))]/20 text-[hsl(var(--neon-green))] ml-auto">Calculado</span>}
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Monte Carlo (10k simulações)</div>
              <div className="flex gap-2">
                <div className="flex-1 bg-[hsl(var(--neon-green))]/10 rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-[hsl(var(--neon-green))]">{quant.monte_carlo_bull_pct?.toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground">Alta</div>
                </div>
                <div className="flex-1 bg-[hsl(var(--neon-red))]/10 rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-[hsl(var(--neon-red))]">{quant.monte_carlo_bear_pct?.toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground">Baixa</div>
                </div>
              </div>
            </div>

            {extendedMonteCarlo && (
              <div className="rounded-xl p-3 border border-border/30 bg-muted/20">
                <div className="text-xs text-muted-foreground mb-2">Projeção Expandida ({extendedMonteCarlo.horizon_bars} candles)</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Otimista</span><span className="font-mono text-foreground">{extendedMonteCarlo.optimistic_target.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Mediana</span><span className="font-mono text-foreground">{extendedMonteCarlo.median_target.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pessimista</span><span className="font-mono text-foreground">{extendedMonteCarlo.pessimistic_target.toFixed(2)}</span></div>
                </div>
                {extendedMonteCarlo.seasonality?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/20">
                    <div className="text-[10px] text-muted-foreground mb-1">Sazonalidade (meses mais fortes)</div>
                    {extendedMonteCarlo.seasonality.slice(0, 3).map((m) => (
                      <div key={m.month} className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">{m.month}</span>
                        <span className="font-mono text-foreground">{m.avg_return_pct}% • WR {m.win_rate_pct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {[
              { label: "Sharpe Ratio", value: quant.sharpe_ratio?.toFixed(2) },
              { label: "Sortino Ratio", value: quant.sortino_ratio?.toFixed(2) },
              { label: "Max Drawdown", value: `${quant.max_drawdown_pct?.toFixed(2)}%` },
              { label: "VaR 95%", value: `${quant.var_95_pct?.toFixed(2)}%` },
              { label: "Win Rate Histórico", value: `${quant.win_rate_historical?.toFixed(1)}%` },
            ].map((row) => (
              <div key={row.label} className="flex justify-between text-sm py-1 border-b border-border/20">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-mono text-foreground">{row.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Fibonacci Levels */}
        {data._fibonacci && (
          <motion.div {...fadeUp} transition={{ delay: 0.52 }} className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-foreground">Fibonacci</h3>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--neon-green))]/20 text-[hsl(var(--neon-green))] ml-auto">Calculado</span>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground mb-2">
                Swing: {data._fibonacci.swingLow.toFixed(2)} → {data._fibonacci.swingHigh.toFixed(2)} ({data._fibonacci.isUptrend ? "↑ Uptrend" : "↓ Downtrend"})
              </div>
              {[
                { label: "23.6%", value: data._fibonacci.level_236 },
                { label: "38.2%", value: data._fibonacci.level_382 },
                { label: "50.0%", value: data._fibonacci.level_500 },
                { label: "61.8%", value: data._fibonacci.level_618 },
                { label: "78.6%", value: data._fibonacci.level_786 },
              ].map(f => (
                <div key={f.label} className={`flex justify-between text-xs py-1 border-b border-border/20 ${data._fibonacci!.nearestLevel === `level_${f.label.replace('.', '').replace('%', '')}` ? "bg-primary/10 rounded px-2 -mx-2 font-bold" : ""}`}>
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-mono text-foreground">{f.value.toFixed(2)}</span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-border/30">
                <div className="text-[10px] text-muted-foreground">Extensões</div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-muted-foreground">127.2%</span>
                  <span className="font-mono text-accent">{data._fibonacci.ext_1272.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">161.8%</span>
                  <span className="font-mono text-accent">{data._fibonacci.ext_1618.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Market Session + Fear & Greed + Funding */}
        <motion.div {...fadeUp} transition={{ delay: 0.55 }} className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">Contexto Macro</h3>
          </div>
          <div className="space-y-3">
            {/* Session */}
            {data._market_session && (
              <div className="bg-muted/20 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3 h-3 text-primary" />
                  <span className="text-xs font-bold text-foreground">{data._market_session.session}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">{data._market_session.description}</div>
                <div className={`text-[10px] mt-1 font-semibold ${data._market_session.volatilityExpectation.includes("MÁXIMA") || data._market_session.volatilityExpectation.includes("ALTA") ? "text-[hsl(var(--neon-red))]" : "text-muted-foreground"}`}>
                  {data._market_session.volatilityExpectation}
                </div>
              </div>
            )}
            {/* Fear & Greed */}
            {data._fear_greed && (
              <div className="bg-muted/20 rounded-xl p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">Fear & Greed</span>
                  <span className={`text-xs font-bold ${data._fear_greed.value < 25 ? "text-[hsl(var(--neon-red))]" : data._fear_greed.value > 75 ? "text-[hsl(var(--neon-green))]" : "text-foreground"}`}>
                    {data._fear_greed.value}/100
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${data._fear_greed.value < 25 ? "bg-[hsl(var(--neon-red))]" : data._fear_greed.value > 75 ? "bg-[hsl(var(--neon-green))]" : "bg-primary"}`} style={{ width: `${data._fear_greed.value}%` }} />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">{data._fear_greed.classification}</div>
              </div>
            )}
            {/* Funding Rate */}
            {data._funding_rate !== null && data._funding_rate !== undefined && (
              <div className="flex justify-between text-xs py-2 border-b border-border/20">
                <span className="text-muted-foreground">Funding Rate</span>
                <span className={`font-mono font-bold ${data._funding_rate > 0.0005 ? "text-[hsl(var(--neon-red))]" : data._funding_rate < -0.0005 ? "text-[hsl(var(--neon-green))]" : "text-foreground"}`}>
                  {(data._funding_rate * 100).toFixed(4)}%
                </span>
              </div>
            )}
            {/* Volume Delta */}
            {data._volume_delta && (
              <div className="bg-muted/20 rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-1">Delta de Volume</div>
                <div className="flex gap-2">
                  <div className="flex-1 text-center p-2 rounded-lg bg-[hsl(var(--neon-green))]/10">
                    <div className="text-xs font-bold text-[hsl(var(--neon-green))]">{data._volume_delta.buyVolume > 1e6 ? `${(data._volume_delta.buyVolume / 1e6).toFixed(1)}M` : data._volume_delta.buyVolume.toLocaleString()}</div>
                    <div className="text-[9px] text-muted-foreground">Compra</div>
                  </div>
                  <div className="flex-1 text-center p-2 rounded-lg bg-[hsl(var(--neon-red))]/10">
                    <div className="text-xs font-bold text-[hsl(var(--neon-red))]">{data._volume_delta.sellVolume > 1e6 ? `${(data._volume_delta.sellVolume / 1e6).toFixed(1)}M` : data._volume_delta.sellVolume.toLocaleString()}</div>
                    <div className="text-[9px] text-muted-foreground">Venda</div>
                  </div>
                </div>
                <div className={`text-[10px] font-semibold mt-1 text-center ${data._volume_delta.pressure === "COMPRADORES" ? "text-[hsl(var(--neon-green))]" : data._volume_delta.pressure === "VENDEDORES" ? "text-[hsl(var(--neon-red))]" : "text-muted-foreground"}`}>
                  Pressão: {data._volume_delta.pressure} (Ratio: {data._volume_delta.ratio})
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Backtest + Kelly + Confidence */}
        <motion.div {...fadeUp} transition={{ delay: 0.58 }} className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-foreground">Validação & Sizing</h3>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--neon-green))]/20 text-[hsl(var(--neon-green))] ml-auto">Calculado</span>
          </div>
          <div className="space-y-3">
            {/* Backtest */}
            {data._backtest && (
              <div className="bg-muted/20 rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-2">Backtest do Setup (Histórico)</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-sm font-bold text-[hsl(var(--neon-green))]">{data._backtest.wins}</div>
                    <div className="text-[9px] text-muted-foreground">Wins</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[hsl(var(--neon-red))]">{data._backtest.losses}</div>
                    <div className="text-[9px] text-muted-foreground">Losses</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-primary">{data._backtest.winRate}%</div>
                    <div className="text-[9px] text-muted-foreground">Win Rate</div>
                  </div>
                </div>
              </div>
            )}
            {/* Kelly */}
            {data._kelly && (
              <div className={`rounded-xl p-3 border ${data._kelly.kellyPct > 0 ? "bg-primary/10 border-primary/20" : "bg-[hsl(var(--neon-red))]/10 border-[hsl(var(--neon-red))]/20"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Gauge className="w-3 h-3 text-primary" />
                  <span className="text-xs font-bold text-foreground">Kelly Criterion</span>
                </div>
                <div className="text-lg font-bold text-primary">{data._kelly.halfKellyPct}%</div>
                <div className="text-[10px] text-muted-foreground">{data._kelly.recommendation}</div>
              </div>
            )}
            {/* ATR Trailing */}
            {data._atr_trailing && (
              <div className="flex justify-between text-xs py-2 border-b border-border/20">
                <span className="text-muted-foreground">ATR Trailing Stop ({data._atr_trailing.multiplier}x)</span>
                <span className="font-mono font-bold text-foreground">{data._atr_trailing.bestTrailingStop.toLocaleString()}</span>
              </div>
            )}
            {/* Confidence Decay */}
            {data._confidence_decay && (
              <div className="flex justify-between text-xs py-2 border-b border-border/20">
                <span className="text-muted-foreground flex items-center gap-1"><Timer className="w-3 h-3" /> Validade</span>
                <span className={`font-bold ${data._confidence_decay.validity === "FRESCA" ? "text-[hsl(var(--neon-green))]" : data._confidence_decay.validity === "EXPIRADA" ? "text-[hsl(var(--neon-red))]" : "text-primary"}`}>
                  {data._confidence_decay.validity}
                </span>
              </div>
            )}
            {/* Liquidation Levels */}
            {data._liquidation_levels && (
              <div className="bg-muted/20 rounded-xl p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  <Flame className="w-3 h-3 text-[hsl(var(--neon-red))]" /> Clusters de Liquidação
                </div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[hsl(var(--neon-green))]">Long Liq (caça)</span>
                  <span className="font-mono">${data._liquidation_levels.nearestLongCluster.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[hsl(var(--neon-red))]">Short Squeeze</span>
                  <span className="font-mono">${data._liquidation_levels.nearestShortCluster.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Sentiment */}
        <motion.div {...fadeUp} transition={{ delay: 0.6 }} className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Newspaper className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">Sentimento & Notícias</h3>
            <AIBadge />
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <MetricCard label="News" value={sentiment.news_score?.toFixed(2)} color={sentiment.news_score > 0 ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"} />
            <MetricCard label="Social" value={sentiment.social_score?.toFixed(2)} color={sentiment.social_score > 0 ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"} />
            <MetricCard label="Overall" value={sentiment.overall} />
          </div>
          <div className="text-xs text-muted-foreground mb-2">Headlines recentes:</div>
          <div className="space-y-2">
            {sentiment.recent_headlines?.map((h, i) => (
              <div key={i} className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-2">
                {h}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Institutional Synthesis */}
      <motion.div {...fadeUp} transition={{ delay: 0.7 }} className="glass rounded-2xl p-6 neon-border">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground text-lg">Síntese Institucional</h3>
          {!isDefaultSummary && <AIBadge />}
        </div>
        {isDefaultSummary ? (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground mb-3">
              Resumo executivo gerado pelo motor determinístico. Clique para obter narrativa detalhada via IA.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 font-mono bg-muted/20 rounded-xl p-4">
              {synthesis.executive_summary}
            </p>
            <Button
              onClick={() => handleGenerateAI("executive_summary")}
              disabled={aiLoading.executive_summary}
              size="sm"
              variant="outline"
              className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
            >
              {aiLoading.executive_summary ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiLoading.executive_summary ? "Gerando..." : "🤖 Gerar Narrativa com IA"}
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 font-mono">
              {typedSummary}
              {isTyping && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 align-middle" />}
            </p>
            <div className="flex items-start gap-2 bg-[hsl(var(--neon-red))]/5 rounded-xl p-4 border border-[hsl(var(--neon-red))]/20">
              <AlertTriangle className="w-5 h-5 text-[hsl(var(--neon-red))] flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-[hsl(var(--neon-red))] mb-1">Riscos Mapeados</div>
                <p className="text-xs text-muted-foreground">{synthesis.warning}</p>
              </div>
            </div>
            {synthesis.best_hours?.length > 0 && (
              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 text-primary" />
                <span>Melhores horários: {synthesis.best_hours?.join(", ")}</span>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Heatmap — pass candles for real calculation */}
      <TradingHeatmap asset={header.asset} candles={candles} />

      {/* Disclaimer */}
      <p className="text-center text-xs text-muted-foreground/50 mt-6">
        ⚠️ Disclaimer: Esta análise é gerada por inteligência artificial e não constitui recomendação de investimento. Opere sob sua própria responsabilidade.
      </p>
    </div>
  );
};

export default AnalysisResults;
