import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, TrendingUp, Zap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const POPULAR_ASSETS = [
  { symbol: "BTC/USDT", name: "Bitcoin", category: "Cripto" },
  { symbol: "ETH/USDT", name: "Ethereum", category: "Cripto" },
  { symbol: "SOL/USDT", name: "Solana", category: "Cripto" },
  { symbol: "EUR/USD", name: "Euro/Dólar", category: "Forex" },
  { symbol: "GBP/USD", name: "Libra/Dólar", category: "Forex" },
  { symbol: "USD/JPY", name: "Dólar/Iene", category: "Forex" },
  { symbol: "PETR4", name: "Petrobras", category: "B3" },
  { symbol: "VALE3", name: "Vale", category: "B3" },
  { symbol: "ITUB4", name: "Itaú Unibanco", category: "B3" },
  { symbol: "AAPL", name: "Apple", category: "US Stocks" },
  { symbol: "TSLA", name: "Tesla", category: "US Stocks" },
  { symbol: "NVDA", name: "Nvidia", category: "US Stocks" },
  { symbol: "XAU/USD", name: "Ouro", category: "Commodities" },
  { symbol: "WTI", name: "Petróleo WTI", category: "Commodities" },
];

const TIMEFRAMES = [
  { value: "5M", label: "5 Min" },
  { value: "15M", label: "15 Min" },
  { value: "1H", label: "1 Hora" },
  { value: "4H", label: "4 Horas" },
  { value: "1D", label: "Diário" },
  { value: "1W", label: "Semanal" },
];

interface Props {
  onAnalyze: (asset: string, timeframe: string) => void;
}

const AssetSearch = ({ onAnalyze }: Props) => {
  const [query, setQuery] = useState("");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1H");

  const filtered = useMemo(() => {
    if (!query) return POPULAR_ASSETS;
    const q = query.toLowerCase();
    return POPULAR_ASSETS.filter(
      (a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
    );
  }, [query]);

  const handleSelect = (symbol: string) => {
    setQuery(symbol);
  };

  const handleSubmit = () => {
    const asset = query.trim();
    if (asset) onAnalyze(asset, selectedTimeframe);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent mb-6 neon-glow"
        >
          <Zap className="w-10 h-10 text-primary-foreground" />
        </motion.div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-3">
          Análise <span className="gradient-text">Quantitativa</span> com IA
        </h1>
        <p className="text-muted-foreground text-lg max-w-lg mx-auto">
          Escolha um ativo e deixe nosso motor de inteligência artificial gerar a tese completa.
        </p>
      </div>

      {/* Search */}
      <div className="glass rounded-2xl p-6 mb-6 neon-border">
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Buscar ativo... (ex: BTC, EUR/USD, PETR4)"
              className="pl-10 bg-background/50 border-border/50 h-12 text-base"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!query.trim()}
            className="bg-gradient-to-r from-primary to-accent text-primary-foreground neon-glow h-12 px-8"
          >
            <TrendingUp className="w-5 h-5 mr-2" /> Analisar
          </Button>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground mr-1">Timeframe:</span>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setSelectedTimeframe(tf.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedTimeframe === tf.value
                  ? "bg-primary text-primary-foreground neon-glow"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Asset suggestions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {filtered.slice(0, 8).map((asset, i) => (
          <motion.button
            key={asset.symbol}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => handleSelect(asset.symbol)}
            className="glass rounded-xl p-4 text-left hover:neon-border transition-all group"
          >
            <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
              {asset.symbol}
            </div>
            <div className="text-xs text-muted-foreground">{asset.name}</div>
            <div className="mt-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                {asset.category}
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default AssetSearch;
