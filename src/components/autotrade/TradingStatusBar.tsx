import { motion, AnimatePresence } from "framer-motion";
import { Bot, Search, TrendingUp, Shield, Pause, Radio } from "lucide-react";
import { useEffect, useState } from "react";

type TradingStatus =
  | "disconnected"
  | "searching"
  | "awaiting_liquidity"
  | "in_position"
  | "macro_blocked"
  | "daily_limit"
  | "paused";

interface TradingStatusBarProps {
  isConnected: boolean;
  isAutopilotActive: boolean;
  hasPositions: boolean;
}

const statusConfig: Record<TradingStatus, {
  icon: typeof Bot;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  pulse: boolean;
}> = {
  disconnected: {
    icon: Pause,
    label: "DESCONECTADO",
    description: "Conecte sua corretora para iniciar",
    color: "text-muted-foreground",
    bgColor: "bg-muted/30 border-border/30",
    pulse: false,
  },
  searching: {
    icon: Search,
    label: "ANALISANDO MERCADO",
    description: "IA escaneando padrões institucionais e liquidez...",
    color: "text-[hsl(var(--neon-blue))]",
    bgColor: "bg-[hsl(var(--neon-blue))]/5 border-[hsl(var(--neon-blue))]/20",
    pulse: true,
  },
  awaiting_liquidity: {
    icon: Radio,
    label: "AGUARDANDO VARREDURA",
    description: "Cluster de liquidez detectado — aguardando sweep institucional para Sniper Entry",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/5 border-yellow-400/20",
    pulse: true,
  },
  in_position: {
    icon: TrendingUp,
    label: "EM OPERAÇÃO",
    description: "Posições ativas — Trailing Stop e gestão de risco em execução",
    color: "text-[hsl(var(--neon-green))]",
    bgColor: "bg-[hsl(var(--neon-green))]/5 border-[hsl(var(--neon-green))]/20",
    pulse: true,
  },
  macro_blocked: {
    icon: Shield,
    label: "MACRO SHIELD ATIVO",
    description: "Entradas bloqueadas — anomalia on-chain detectada",
    color: "text-[hsl(var(--neon-red))]",
    bgColor: "bg-[hsl(var(--neon-red))]/5 border-[hsl(var(--neon-red))]/20",
    pulse: true,
  },
  daily_limit: {
    icon: Shield,
    label: "META DIÁRIA ATINGIDA",
    description: "Robô pausado — capital protegido até próxima sessão",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/5 border-yellow-400/20",
    pulse: false,
  },
  paused: {
    icon: Pause,
    label: "PILOTO AUTOMÁTICO OFF",
    description: "Ative o Piloto Automático para iniciar execução autônoma",
    color: "text-muted-foreground",
    bgColor: "bg-muted/30 border-border/30",
    pulse: false,
  },
};

// Simulate rotating search states when no positions
const searchStates: TradingStatus[] = ["searching", "awaiting_liquidity", "searching"];

export default function TradingStatusBar({ isConnected, isAutopilotActive, hasPositions }: TradingStatusBarProps) {
  const [searchIndex, setSearchIndex] = useState(0);

  // Cycle through search states for visual feedback
  useEffect(() => {
    if (!isConnected || !isAutopilotActive || hasPositions) return;
    const interval = setInterval(() => {
      setSearchIndex((i) => (i + 1) % searchStates.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isConnected, isAutopilotActive, hasPositions]);

  let currentStatus: TradingStatus;
  if (!isConnected) {
    currentStatus = "disconnected";
  } else if (!isAutopilotActive) {
    currentStatus = "paused";
  } else if (hasPositions) {
    currentStatus = "in_position";
  } else {
    currentStatus = searchStates[searchIndex];
  }

  const config = statusConfig[currentStatus];
  const Icon = config.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStatus}
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        transition={{ duration: 0.3 }}
        className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${config.bgColor}`}
      >
        {/* Icon with pulse */}
        <div className="relative">
          {config.pulse && (
            <motion.div
              animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`absolute inset-0 rounded-full ${config.color.replace("text-", "bg-")} opacity-30`}
            />
          )}
          <Icon className={`w-5 h-5 ${config.color} relative z-10`} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold font-mono tracking-wider ${config.color}`}>
              {config.label}
            </span>
            {config.pulse && (
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.color.replace("text-", "bg-")}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${config.color.replace("text-", "bg-")}`} />
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{config.description}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
