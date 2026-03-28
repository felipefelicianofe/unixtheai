import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const activities = [
  "Vanessa S. analisou USD/JPY • COMPRA +3.1% há 2 min",
  "Roberto M. analisou BTC/USD • VENDA -1.2% há 5 min",
  "Ana C. analisou PETR4 • COMPRA +2.8% há 1 min",
  "Lucas F. analisou EUR/USD • COMPRA +1.5% há 3 min",
  "Maria L. analisou SOL/USD • COMPRA +5.4% há 30s",
  "Pedro R. analisou AAPL • COMPRA +0.9% há 4 min",
];

const stats = [
  { value: 94.7, suffix: "%", label: "Precisão" },
  { value: 2.4, prefix: "R$ ", suffix: "M+", label: "Protegidos" },
  { value: 2, prefix: "<", suffix: "s", label: "Tempo de Análise" },
  { value: 50, suffix: "k+", label: "Análises/Dia" },
];

const AnimatedCounter = ({ value, prefix = "", suffix = "", label }: { value: number; prefix?: string; suffix?: string; label: string }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(current);
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="text-center"
    >
      <div className="text-2xl sm:text-3xl font-bold text-foreground">
        {prefix}{count % 1 === 0 ? Math.floor(count) : count.toFixed(1)}{suffix}
      </div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </motion.div>
  );
};

const Hero = () => {
  const [activityIndex, setActivityIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActivityIndex((i) => (i + 1) % activities.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative pt-32 pb-20 px-4 overflow-hidden">
      {/* Animated background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/15 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[200px]" />
      </div>

      <div className="max-w-5xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-8 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--neon-green))] animate-pulse" />
            Plataforma ativa — Análises em tempo real
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold leading-tight tracking-tight mb-6">
            Opere com Precisão de{" "}
            <span className="gradient-text">Inteligência Artificial</span>.
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Quais as análises que são feitas na plataforma?
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button asChild size="lg" className="bg-gradient-to-r from-primary to-accent text-primary-foreground neon-glow px-8 text-base">
              <Link to="/dashboard">Começar Grátis</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2 border-border/60 text-foreground hover:bg-muted/30">
              <Link to="/dashboard"><Play className="w-4 h-4" /> Ver Demonstração</Link>
            </Button>
          </div>
        </motion.div>

        {/* Live activity ticker */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="glass rounded-full px-6 py-2.5 max-w-lg mx-auto mb-16"
        >
          <motion.p
            key={activityIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-sm text-muted-foreground truncate"
          >
            🟢 {activities[activityIndex]}
          </motion.p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
          {stats.map((stat) => (
            <AnimatedCounter key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
