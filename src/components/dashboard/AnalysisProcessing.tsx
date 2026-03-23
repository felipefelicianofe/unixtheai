import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Brain, BarChart3, Newspaper, Shield, Target } from "lucide-react";

const STEPS = [
  { id: 1, label: "Conectando com provedores de dados...", icon: BarChart3, duration: 1500 },
  { id: 2, label: "Coletando dados OHLCV e volume...", icon: BarChart3, duration: 2000 },
  { id: 3, label: "Calculando RSI, MACD, ADX e 26 osciladores...", icon: Brain, duration: 2500 },
  { id: 4, label: "Mapeando Order Blocks e Fair Value Gaps (SMC)...", icon: Target, duration: 2000 },
  { id: 5, label: "Executando 10.000 simulações Monte Carlo...", icon: Brain, duration: 3000 },
  { id: 6, label: "Analisando estruturas Wyckoff, Elliott e Gann...", icon: BarChart3, duration: 2000 },
  { id: 7, label: "Lendo e classificando notícias via FinBERT...", icon: Newspaper, duration: 2500 },
  { id: 8, label: "Calculando Entry, Stop Loss e Take Profits (ATR)...", icon: Shield, duration: 2000 },
  { id: 9, label: "Consolidando Tese Institucional com IA...", icon: Brain, duration: 3000 },
];

interface Props {
  asset: string;
  timeframe: string;
}

const AnalysisProcessing = ({ asset, timeframe }: Props) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    let step = 0;
    const advance = () => {
      if (step < STEPS.length - 1) {
        step++;
        setCurrentStep(step);
        setTimeout(advance, STEPS[step].duration);
      }
    };
    setTimeout(advance, STEPS[0].duration);
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent mb-6"
        >
          <Brain className="w-10 h-10 text-primary-foreground" />
        </motion.div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Analisando <span className="gradient-text">{asset}</span>
        </h2>
        <p className="text-muted-foreground">
          Timeframe: {timeframe} • Motor Quantitativo Ativo
        </p>
      </div>

      {/* Progress bar */}
      <div className="glass rounded-2xl p-6 neon-border mb-8">
        <div className="h-2 bg-muted rounded-full overflow-hidden mb-6">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isDone = i < currentStep;
            const isCurrent = i === currentStep;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{
                  opacity: i <= currentStep ? 1 : 0.3,
                  x: 0,
                }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
                className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${
                  isCurrent ? "bg-primary/10" : ""
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isDone
                    ? "bg-[hsl(var(--neon-green))]/20 text-[hsl(var(--neon-green))]"
                    : isCurrent
                    ? "bg-primary/20 text-primary"
                    : "bg-muted/30 text-muted-foreground"
                }`}>
                  {isDone ? (
                    <Check className="w-4 h-4" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span className={`text-sm ${
                  isDone
                    ? "text-[hsl(var(--neon-green))]"
                    : isCurrent
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                }`}>
                  {step.label}
                </span>
                {isDone && (
                  <span className="ml-auto text-xs text-[hsl(var(--neon-green))]">✓</span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Animated data visualization */}
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-center text-sm text-muted-foreground"
      >
        Processando dados de mercado em tempo real...
      </motion.div>
    </div>
  );
};

export default AnalysisProcessing;
