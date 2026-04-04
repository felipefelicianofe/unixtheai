import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus,
  Shield, Target, Crosshair, Layers, Activity, AlertTriangle,
  ChevronDown, ChevronUp, Zap, Eye, BarChart3, Gauge
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { AISignal } from "@/hooks/useLiveTradeEngine";

interface Props {
  aiSignal: AISignal;
  onRefresh: () => void;
  asset: string;
}

function Section({ title, icon: Icon, children, defaultOpen = false }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/20 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/10 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-foreground">{title}</span>
        </div>
        {open ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-3 space-y-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetricRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex justify-between items-center text-[10px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-bold ${color || "text-foreground"}`}>{value}</span>
    </div>
  );
}

function SignalBadge({ label, type }: { label: string; type: "buy" | "sell" | "neutral" }) {
  const colors = {
    buy: "bg-[hsl(var(--neon-green))]/15 text-[hsl(var(--neon-green))] border-[hsl(var(--neon-green))]/25",
    sell: "bg-[hsl(var(--neon-red))]/15 text-[hsl(var(--neon-red))] border-[hsl(var(--neon-red))]/25",
    neutral: "bg-muted/30 text-muted-foreground border-border/30",
  };
  return (
    <span className={`text-[9px] px-2 py-0.5 rounded-md border font-mono ${colors[type]}`}>{label}</span>
  );
}

const AIAssistant = memo(({ aiSignal, onRefresh, asset }: Props) => {
  const directionIcon = {
    LONG: <TrendingUp className="w-5 h-5" />,
    SHORT: <TrendingDown className="w-5 h-5" />,
    NEUTRAL: <Minus className="w-5 h-5" />,
  };

  const directionColor = {
    LONG: "text-[hsl(var(--neon-green))]",
    SHORT: "text-[hsl(var(--neon-red))]",
    NEUTRAL: "text-muted-foreground",
  };

  const directionBg = {
    LONG: "bg-[hsl(var(--neon-green))]/10 border-[hsl(var(--neon-green))]/20",
    SHORT: "bg-[hsl(var(--neon-red))]/10 border-[hsl(var(--neon-red))]/20",
    NEUTRAL: "bg-muted/30 border-border/30",
  };

  const activeFVGs = aiSignal.fairValueGaps.filter(f => !f.status || f.status === "ACTIVE");
  const activeOBs = aiSignal.orderBlocks.filter(o => !o.status || o.status === "ACTIVE");
  const rm = aiSignal.riskManagement;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass-card rounded-2xl p-5 border border-border/20 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Pro Trader AI</h3>
            <p className="text-[10px] text-muted-foreground">
              Análise profissional • {asset.replace("USDT", "/USDT")}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={aiSignal.loading}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          {aiSignal.loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* Direction + Confidence */}
      <div className={`p-4 rounded-xl border ${directionBg[aiSignal.direction]}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${directionBg[aiSignal.direction]} ${directionColor[aiSignal.direction]}`}>
            {directionIcon[aiSignal.direction]}
          </div>
          <div className="flex-1">
            <div className={`text-lg font-black ${directionColor[aiSignal.direction]}`}>
              {aiSignal.direction}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>Confiança: <strong className="text-foreground font-mono">{aiSignal.confidence.toFixed(0)}%</strong></span>
              <span>Força: <strong className="text-foreground font-mono">{aiSignal.signalStrength.toFixed(0)}%</strong></span>
            </div>
          </div>
        </div>
        {/* Signal counts */}
        <div className="mt-3 flex items-center gap-2">
          <SignalBadge label={`${aiSignal.buySignals} Buy`} type="buy" />
          <SignalBadge label={`${aiSignal.sellSignals} Sell`} type="sell" />
          <SignalBadge label={`${aiSignal.neutralSignals} Neutro`} type="neutral" />
        </div>
        {/* Confidence bar */}
        <div className="mt-3">
          <Progress value={aiSignal.confidence} className="h-1.5" />
        </div>
      </div>

      {/* Master Verdict */}
      {aiSignal.masterVerdict && (
        <div className={`p-3 rounded-xl border text-[10px] flex items-start gap-2 ${
          aiSignal.masterVerdict === "CONFIRMED" ? "bg-[hsl(var(--neon-green))]/5 border-[hsl(var(--neon-green))]/20" :
          aiSignal.masterVerdict === "DOWNGRADED" ? "bg-primary/5 border-primary/20" :
          "bg-[hsl(var(--neon-red))]/5 border-[hsl(var(--neon-red))]/20"
        }`}>
          <Shield className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
          <div>
            <span className="font-bold text-foreground">Master: {aiSignal.masterVerdict}</span>
            {aiSignal.masterQuality !== null && (
              <span className="ml-2 text-muted-foreground">Score: {aiSignal.masterQuality.toFixed(0)}</span>
            )}
            {aiSignal.masterWarnings.length > 0 && (
              <div className="mt-1 text-muted-foreground">
                {aiSignal.masterWarnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Executive Summary */}
      {aiSignal.executiveSummary && (
        <p className="text-[11px] text-muted-foreground leading-relaxed bg-muted/10 rounded-lg p-3 border border-border/10">
          {aiSignal.executiveSummary}
        </p>
      )}

      {/* Warning */}
      {aiSignal.warning && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[hsl(var(--neon-red))]/5 border border-[hsl(var(--neon-red))]/15 text-[10px] text-muted-foreground">
          <AlertTriangle className="w-3 h-3 mt-0.5 text-[hsl(var(--neon-red))] shrink-0" />
          <span>{aiSignal.warning}</span>
        </div>
      )}

      {/* === SECTIONS === */}

      {/* SMC / Price Action */}
      <Section title="Smart Money Concepts (SMC)" icon={Eye} defaultOpen={true}>
        {aiSignal.smcBias && <MetricRow label="Bias Institucional" value={aiSignal.smcBias} color={
          aiSignal.smcBias.toLowerCase().includes("bull") ? "text-[hsl(var(--neon-green))]" : aiSignal.smcBias.toLowerCase().includes("bear") ? "text-[hsl(var(--neon-red))]" : undefined
        } />}
        {aiSignal.breakOfStructure && <MetricRow label="Break of Structure" value={aiSignal.breakOfStructure} />}
        
        {activeOBs.length > 0 && (
          <div className="mt-2">
            <p className="text-[9px] text-muted-foreground font-bold uppercase mb-1">Order Blocks Ativos</p>
            {activeOBs.map((ob, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] py-1 border-b border-border/10 last:border-0">
                <span className={`w-1.5 h-1.5 rounded-full ${ob.type.toLowerCase().includes("bull") ? "bg-[hsl(var(--neon-green))]" : "bg-[hsl(var(--neon-red))]"}`} />
                <span className="text-foreground font-mono">{ob.price_zone}</span>
                <span className="text-muted-foreground ml-auto">{ob.strength}</span>
              </div>
            ))}
          </div>
        )}

        {activeFVGs.length > 0 && (
          <div className="mt-2">
            <p className="text-[9px] text-muted-foreground font-bold uppercase mb-1">Fair Value Gaps (FVG)</p>
            {activeFVGs.map((fvg, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] py-1 border-b border-border/10 last:border-0">
                <span className={`w-1.5 h-1.5 rounded-full ${fvg.direction.toLowerCase().includes("bull") ? "bg-[hsl(var(--neon-green))]" : "bg-[hsl(var(--neon-red))]"}`} />
                <span className="text-muted-foreground">{fvg.direction}</span>
                <span className="text-foreground font-mono ml-auto">{fvg.zone}</span>
              </div>
            ))}
          </div>
        )}

        {aiSignal.liquidityZones.length > 0 && (
          <div className="mt-2">
            <p className="text-[9px] text-muted-foreground font-bold uppercase mb-1">Zonas de Liquidez</p>
            {aiSignal.liquidityZones.slice(0, 4).map((lz, i) => (
              <div key={i} className="flex items-center justify-between text-[10px] py-0.5">
                <span className="text-muted-foreground">{lz.type}</span>
                <span className="font-mono text-foreground">${lz.price.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Structure Analysis */}
      <Section title="Estrutura & Padrões" icon={Layers}>
        {aiSignal.wyckoffPhase && <MetricRow label="Wyckoff" value={aiSignal.wyckoffPhase} />}
        {aiSignal.elliottWave && <MetricRow label="Elliott Wave" value={aiSignal.elliottWave} />}
        {aiSignal.dowTheory && <MetricRow label="Dow Theory" value={aiSignal.dowTheory} />}
        {aiSignal.confluenceScore && <MetricRow label="Confluência" value={aiSignal.confluenceScore} />}
        {aiSignal.htfBias && <MetricRow label="HTF Bias" value={aiSignal.htfBias} color={
          aiSignal.htfBias === "BUY" ? "text-[hsl(var(--neon-green))]" : aiSignal.htfBias === "SELL" ? "text-[hsl(var(--neon-red))]" : undefined
        } />}
        {aiSignal.emaCrossover && aiSignal.emaCrossover.crossed && (
          <MetricRow label="EMA Crossover" value={`${aiSignal.emaCrossover.type} (${aiSignal.emaCrossover.barsAgo} bars atrás)`} color={
            aiSignal.emaCrossover.type === "GOLDEN_CROSS" ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"
          } />
        )}
        {aiSignal.harmonicPatterns.length > 0 && (
          <div className="mt-2">
            <p className="text-[9px] text-muted-foreground font-bold uppercase mb-1">Harmônicos</p>
            {aiSignal.harmonicPatterns.map((hp, i) => (
              <div key={i} className="flex items-center justify-between text-[10px] py-0.5">
                <span className="text-muted-foreground">{hp.pattern} ({hp.direction})</span>
                <span className="font-mono text-foreground">{hp.completion_pct}%</span>
              </div>
            ))}
          </div>
        )}
        {aiSignal.fibonacci && (
          <MetricRow label={`Fib ${aiSignal.fibonacci.nearestLevel}`} value={`$${aiSignal.fibonacci.nearestPrice.toLocaleString()}`} />
        )}
      </Section>

      {/* Technical Indicators */}
      <Section title="Indicadores Técnicos" icon={Activity}>
        {aiSignal.rsi && (
          <MetricRow label="RSI (14)" value={`${aiSignal.rsi.value.toFixed(1)} • ${aiSignal.rsi.signal}`} color={
            aiSignal.rsi.value > 70 ? "text-[hsl(var(--neon-red))]" : aiSignal.rsi.value < 30 ? "text-[hsl(var(--neon-green))]" : undefined
          } />
        )}
        {aiSignal.macd && (
          <MetricRow label="MACD" value={`${aiSignal.macd.histogram > 0 ? "+" : ""}${aiSignal.macd.histogram.toFixed(2)} • ${aiSignal.macd.signal}`} color={
            aiSignal.macd.histogram > 0 ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"
          } />
        )}
        {aiSignal.adx && (
          <MetricRow label="ADX" value={`${aiSignal.adx.value.toFixed(1)} • ${aiSignal.adx.trend_strength}`} />
        )}
        {aiSignal.stochastic && (
          <MetricRow label="Stoch K/D" value={`${aiSignal.stochastic.k.toFixed(1)} / ${aiSignal.stochastic.d.toFixed(1)}`} />
        )}
        {aiSignal.vwap !== null && (
          <MetricRow label="VWAP" value={`$${aiSignal.vwap.toLocaleString()}`} />
        )}
        {aiSignal.bollinger && (
          <div className="mt-1">
            <p className="text-[9px] text-muted-foreground font-bold uppercase mb-1">Bollinger Bands</p>
            <MetricRow label="Upper" value={`$${aiSignal.bollinger.upper.toLocaleString()}`} />
            <MetricRow label="Middle" value={`$${aiSignal.bollinger.middle.toLocaleString()}`} />
            <MetricRow label="Lower" value={`$${aiSignal.bollinger.lower.toLocaleString()}`} />
          </div>
        )}
        {(aiSignal.ema20 || aiSignal.ema50 || aiSignal.ema200) && (
          <div className="mt-1">
            <p className="text-[9px] text-muted-foreground font-bold uppercase mb-1">EMAs</p>
            {aiSignal.ema20 !== null && <MetricRow label="EMA 20" value={`$${aiSignal.ema20.toLocaleString()}`} />}
            {aiSignal.ema50 !== null && <MetricRow label="EMA 50" value={`$${aiSignal.ema50.toLocaleString()}`} />}
            {aiSignal.ema200 !== null && <MetricRow label="EMA 200" value={`$${aiSignal.ema200.toLocaleString()}`} />}
          </div>
        )}
      </Section>

      {/* Risk Management */}
      {rm && (
        <Section title="Gestão de Risco" icon={Target}>
          <MetricRow label="Entry" value={`$${rm.entry_price.toLocaleString()}`} />
          <MetricRow label="Stop Loss" value={`$${rm.stop_loss.toLocaleString()}`} color="text-[hsl(var(--neon-red))]" />
          <MetricRow label="TP1" value={`$${rm.take_profit_1.toLocaleString()}`} color="text-[hsl(var(--neon-green))]" />
          <MetricRow label="TP2" value={`$${rm.take_profit_2.toLocaleString()}`} color="text-[hsl(var(--neon-green))]" />
          <MetricRow label="TP3" value={`$${rm.take_profit_3.toLocaleString()}`} color="text-[hsl(var(--neon-green))]" />
          <MetricRow label="R:R" value={rm.risk_reward_ratio} />
          <MetricRow label="ATR" value={rm.atr_value.toFixed(2)} />
          <MetricRow label="Risco" value={`${rm.risk_pct.toFixed(1)}%`} />
        </Section>
      )}

      {/* Dual Scenarios */}
      {aiSignal.dualScenarios && (
        <Section title="Cenários Duais" icon={Crosshair}>
          <p className="text-[9px] text-muted-foreground font-bold uppercase mb-1">
            Primário: {aiSignal.dualScenarios.primary_signal}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="p-2 rounded-lg bg-[hsl(var(--neon-green))]/5 border border-[hsl(var(--neon-green))]/15">
              <p className="text-[9px] font-bold text-[hsl(var(--neon-green))] mb-1">COMPRA {aiSignal.dualScenarios.buy.probability_pct}%</p>
              <MetricRow label="Entry" value={`$${aiSignal.dualScenarios.buy.entry.toLocaleString()}`} />
              <MetricRow label="SL" value={`$${aiSignal.dualScenarios.buy.stop_loss.toLocaleString()}`} />
              <MetricRow label="TP1" value={`$${aiSignal.dualScenarios.buy.take_profit_1.toLocaleString()}`} />
            </div>
            <div className="p-2 rounded-lg bg-[hsl(var(--neon-red))]/5 border border-[hsl(var(--neon-red))]/15">
              <p className="text-[9px] font-bold text-[hsl(var(--neon-red))] mb-1">VENDA {aiSignal.dualScenarios.sell.probability_pct}%</p>
              <MetricRow label="Entry" value={`$${aiSignal.dualScenarios.sell.entry.toLocaleString()}`} />
              <MetricRow label="SL" value={`$${aiSignal.dualScenarios.sell.stop_loss.toLocaleString()}`} />
              <MetricRow label="TP1" value={`$${aiSignal.dualScenarios.sell.take_profit_1.toLocaleString()}`} />
            </div>
          </div>
        </Section>
      )}

      {/* Sentiment + Context */}
      <Section title="Contexto de Mercado" icon={Gauge}>
        {aiSignal.trend && <MetricRow label="Tendência" value={aiSignal.trend} color={
          aiSignal.trend === "ALTA" ? "text-[hsl(var(--neon-green))]" : aiSignal.trend === "BAIXA" ? "text-[hsl(var(--neon-red))]" : undefined
        } />}
        {aiSignal.sentimentOverall && <MetricRow label="Sentimento" value={aiSignal.sentimentOverall} />}
        {aiSignal.bestHours.length > 0 && (
          <MetricRow label="Melhores Horários" value={aiSignal.bestHours.slice(0, 3).join(", ")} />
        )}
      </Section>

      {/* Last Update */}
      {aiSignal.lastUpdate && (
        <p className="text-[9px] text-muted-foreground/60 text-center">
          Última atualização: {new Date(aiSignal.lastUpdate).toLocaleTimeString()}
        </p>
      )}
    </motion.div>
  );
});

AIAssistant.displayName = "AIAssistant";
export default AIAssistant;
