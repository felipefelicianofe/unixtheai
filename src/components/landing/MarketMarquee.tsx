import { motion } from "framer-motion";

const markets = [
  { name: "EUR/USD", cat: "Forex", change: +0.42 },
  { name: "GBP/USD", cat: "Forex", change: -0.18 },
  { name: "USD/JPY", cat: "Forex", change: +0.31 },
  { name: "BTC", cat: "Cripto", change: +2.14 },
  { name: "ETH", cat: "Cripto", change: +1.87 },
  { name: "SOL", cat: "Cripto", change: +5.23 },
  { name: "S&P 500", cat: "Índice", change: +0.67 },
  { name: "IBOV", cat: "Índice", change: -0.34 },
  { name: "PETR4", cat: "Ação", change: +1.42 },
  { name: "AAPL", cat: "Ação", change: +0.91 },
  { name: "VALE3", cat: "Ação", change: -0.78 },
  { name: "NVDA", cat: "Ação", change: +3.12 },
];

const MarketMarquee = () => {
  const doubled = [...markets, ...markets];

  return (
    <section className="py-8 border-y border-border/30 overflow-hidden">
      <motion.div
        className="flex gap-4"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        {doubled.map((m, i) => (
          <div
            key={i}
            className="flex items-center gap-3 glass rounded-full px-4 py-2 whitespace-nowrap shrink-0"
          >
            <span className="text-xs text-muted-foreground font-medium">{m.cat}</span>
            <span className="text-sm font-semibold text-foreground">{m.name}</span>
            <span
              className={`text-xs font-bold ${m.change >= 0 ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"}`}
            >
              {m.change >= 0 ? "+" : ""}{m.change.toFixed(2)}%
            </span>
          </div>
        ))}
      </motion.div>
    </section>
  );
};

export default MarketMarquee;
