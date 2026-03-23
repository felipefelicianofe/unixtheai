import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

type MacroStatus = "SAFE" | "WARNING" | "DANGER";

interface MacroEvent {
  type: "whale_alert" | "news_panic" | "funding_extreme" | "none";
  message: string;
  detail: string;
}

const MOCK_EVENTS: MacroEvent[] = [
  { type: "none", message: "Nenhuma anomalia On-Chain", detail: "" },
  { type: "whale_alert", message: "Influxo de Baleia detectado", detail: "5,200 BTC transferidos para Binance nos últimos 15 min. Probabilidade de venda institucional: 73%." },
  { type: "news_panic", message: "Sentimento de Pânico no mercado", detail: "Fear & Greed Index caiu para 12. Múltiplas exchanges com saques acima da média." },
  { type: "funding_extreme", message: "Funding Rate extremo detectado", detail: "Funding Rate em 0.12% — longs sobrecarregados. Risco de liquidação em cascata." },
];

function getStatus(event: MacroEvent): MacroStatus {
  if (event.type === "none") return "SAFE";
  if (event.type === "whale_alert") return "DANGER";
  return "WARNING";
}

interface MacroShieldProps {
  compact?: boolean;
}

export function MacroShieldPill() {
  const [eventIndex, setEventIndex] = useState(0);
  const event = MOCK_EVENTS[eventIndex];
  const status = getStatus(event);

  // Cycle through events for demo
  useEffect(() => {
    const interval = setInterval(() => {
      setEventIndex((i) => (i + 1) % MOCK_EVENTS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const config = {
    SAFE: {
      icon: ShieldCheck,
      color: "text-[hsl(var(--neon-green))]",
      bg: "bg-[hsl(var(--neon-green))]/10",
      border: "border-[hsl(var(--neon-green))]/20",
      dot: "bg-[hsl(var(--neon-green))]",
    },
    WARNING: {
      icon: ShieldAlert,
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
      border: "border-yellow-400/20",
      dot: "bg-yellow-400",
    },
    DANGER: {
      icon: ShieldX,
      color: "text-[hsl(var(--neon-red))]",
      bg: "bg-[hsl(var(--neon-red))]/10",
      border: "border-[hsl(var(--neon-red))]/20",
      dot: "bg-[hsl(var(--neon-red))]",
    },
  }[status];

  const Icon = config.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status + eventIndex}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg} border ${config.border} cursor-default`}
      >
        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
        <span className={`text-[11px] font-semibold ${config.color} whitespace-nowrap`}>
          Macro Shield: {status === "SAFE" ? "Seguro" : event.message}
        </span>
        {status !== "SAFE" && (
          <motion.div
            className={`w-1.5 h-1.5 rounded-full ${config.dot}`}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default function MacroShieldWidget() {
  const [eventIndex, setEventIndex] = useState(1); // Start with whale alert for demo
  const [forceOverride, setForceOverride] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  const event = MOCK_EVENTS[eventIndex];
  const status = getStatus(event);

  // Cycle events
  useEffect(() => {
    const interval = setInterval(() => {
      setEventIndex((i) => (i + 1) % MOCK_EVENTS.length);
      setForceOverride(false);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleOverrideToggle = (checked: boolean) => {
    if (checked) {
      setShowOverrideModal(true);
    } else {
      setForceOverride(false);
    }
  };

  const confirmOverride = () => {
    setForceOverride(true);
    setShowOverrideModal(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="glass rounded-2xl p-6 relative overflow-hidden"
      >
        {/* Danger glow */}
        {status === "DANGER" && !forceOverride && (
          <motion.div
            animate={{ opacity: [0.08, 0.18, 0.08] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ boxShadow: "inset 0 0 60px hsl(var(--neon-red) / 0.12)" }}
          />
        )}

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
            status === "SAFE"
              ? "bg-[hsl(var(--neon-green))]/10 border-[hsl(var(--neon-green))]/20"
              : status === "WARNING"
              ? "bg-yellow-400/10 border-yellow-400/20"
              : "bg-[hsl(var(--neon-red))]/10 border-[hsl(var(--neon-red))]/20"
          }`}>
            {status === "SAFE" ? (
              <ShieldCheck className="w-5 h-5 text-[hsl(var(--neon-green))]" />
            ) : status === "WARNING" ? (
              <ShieldAlert className="w-5 h-5 text-yellow-400" />
            ) : (
              <ShieldX className="w-5 h-5 text-[hsl(var(--neon-red))]" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-foreground font-semibold text-lg">Macro Shield</h3>
            <p className="text-muted-foreground text-xs">Proteção On-Chain & Sentimento Macro</p>
          </div>
        </div>

        {/* Status Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={eventIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`rounded-xl p-4 border mb-4 ${
              status === "SAFE"
                ? "bg-[hsl(var(--neon-green))]/5 border-[hsl(var(--neon-green))]/15"
                : status === "WARNING"
                ? "bg-yellow-400/5 border-yellow-400/15"
                : "bg-[hsl(var(--neon-red))]/5 border-[hsl(var(--neon-red))]/15"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">
                {status === "SAFE" ? "🟢" : status === "WARNING" ? "🟡" : "🔴"}
              </span>
              <div>
                <p className={`text-sm font-semibold ${
                  status === "SAFE" ? "text-[hsl(var(--neon-green))]"
                  : status === "WARNING" ? "text-yellow-400"
                  : "text-[hsl(var(--neon-red))]"
                }`}>
                  {status === "SAFE" ? "Ambiente Seguro — Sem anomalias" : event.message}
                </p>
                {event.detail && (
                  <p className="text-xs text-muted-foreground mt-1">{event.detail}</p>
                )}
                {status !== "SAFE" && !forceOverride && (
                  <p className="text-[11px] text-[hsl(var(--neon-red))]/80 mt-2 font-medium">
                    ⚠️ Entradas {event.type === "whale_alert" ? "Long" : "novas"} suspensas automaticamente
                  </p>
                )}
                {forceOverride && status !== "SAFE" && (
                  <p className="text-[11px] text-yellow-400/80 mt-2 font-medium">
                    ⚡ Override ativo — Operando sob seu próprio risco
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Force Override */}
        {status !== "SAFE" && (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-background/30 border border-border/20">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Force Override</p>
              <p className="text-[10px] text-muted-foreground/70">Ignorar alertas macro e continuar operando</p>
            </div>
            <Switch
              checked={forceOverride}
              onCheckedChange={handleOverrideToggle}
              className="data-[state=checked]:bg-yellow-500"
            />
          </div>
        )}
      </motion.div>

      {/* Override Confirmation Modal */}
      <AnimatePresence>
        {showOverrideModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowOverrideModal(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-2xl p-8 max-w-md w-full mx-4 border border-yellow-500/30"
            >
              <div className="flex justify-between items-start mb-5">
                <div className="w-12 h-12 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-yellow-400" />
                </div>
                <button onClick={() => setShowOverrideModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Confirmar Override de Segurança</h3>
              <p className="text-sm text-muted-foreground mb-2">
                O Macro Shield detectou: <span className="text-yellow-400 font-semibold">{event.message}</span>
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                Ao ativar o override, a IA continuará executando operações mesmo com condições macro adversas. 
                Isso aumenta significativamente o risco de perda.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowOverrideModal(false)} className="flex-1 border-border/50">
                  Manter Proteção
                </Button>
                <Button onClick={confirmOverride} className="flex-1 bg-yellow-500 hover:bg-yellow-500/90 text-black font-bold">
                  Sim, Operar Mesmo Assim
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
