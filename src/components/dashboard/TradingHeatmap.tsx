import { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Props {
  asset: string;
  candles?: CandleData[];
}

// Calculate REAL volatility from candle data grouped by day-of-week and hour
function calculateRealHeatmap(candles: CandleData[]) {
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex"];
  const hours = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];

  // Group candles by day-of-week and hour
  const buckets: Record<string, number[]> = {};
  days.forEach(d => hours.forEach(h => { buckets[`${d}-${h}`] = []; }));

  candles.forEach(c => {
    const date = new Date(c.time * 1000);
    const dow = date.getUTCDay(); // 0=Sun, 1=Mon...
    if (dow === 0 || dow === 6) return; // Skip weekends
    const dayLabel = days[dow - 1];
    const hour = date.getUTCHours();
    const hourLabel = hours.find(h => parseInt(h) === hour);
    if (!dayLabel || !hourLabel) return;

    const volatility = c.high !== 0 ? (c.high - c.low) / c.low : 0;
    buckets[`${dayLabel}-${hourLabel}`]?.push(volatility);
  });

  // Calculate average volatility per bucket
  const data: { day: string; hour: string; volatility: number; volume: number }[] = [];
  let maxVol = 0;

  days.forEach(day => {
    hours.forEach(hour => {
      const vals = buckets[`${day}-${hour}`];
      const avg = vals && vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      if (avg > maxVol) maxVol = avg;
      data.push({ day, hour, volatility: avg, volume: avg });
    });
  });

  // Normalize to 0-1 range
  if (maxVol > 0) {
    data.forEach(d => {
      d.volatility = d.volatility / maxVol;
      d.volume = d.volume / maxVol;
    });
  }

  return { days, hours, data, isReal: maxVol > 0 };
}

// Fallback pattern-based heatmap for assets without enough candle data
function generatePatternHeatmap(asset: string) {
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex"];
  const hours = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];

  const isForex = asset.includes("/") && !asset.includes("USDT");
  const isCrypto = asset.includes("BTC") || asset.includes("ETH") || asset.includes("SOL") || asset.includes("USDT");
  const isB3 = ["PETR4", "VALE3", "ITUB4", "BBDC4", "ABEV3"].some(s => asset.includes(s));

  const data: { day: string; hour: string; volatility: number; volume: number }[] = [];

  // Use deterministic seed from asset name instead of Math.random()
  let seed = 0;
  for (let i = 0; i < asset.length; i++) seed += asset.charCodeAt(i);
  const seededNoise = (x: number) => {
    const n = Math.sin(seed * 9301 + x * 49297) * 49297;
    return n - Math.floor(n);
  };
  let noiseIdx = 0;

  days.forEach((day, di) => {
    hours.forEach((hour, hi) => {
      let baseVol = 0.25;
      noiseIdx++;

      if (isForex) {
        if (hi >= 0 && hi <= 4) baseVol += 0.3; // London
        if (hi >= 5 && hi <= 9) baseVol += 0.45; // NY overlap
        if (hi >= 5 && hi <= 8) baseVol += 0.15;
      } else if (isCrypto) {
        if (hi >= 5 && hi <= 9) baseVol += 0.3;
        if (hi >= 11 && hi <= 14) baseVol += 0.25;
        baseVol += 0.1;
      } else if (isB3) {
        if (hi >= 1 && hi <= 2) baseVol += 0.5; // open
        if (hi >= 8 && hi <= 9) baseVol += 0.4; // close
        if (hi >= 3 && hi <= 7) baseVol += 0.15;
      } else {
        if (hi >= 1 && hi <= 3) baseVol += 0.5;
        if (hi >= 8 && hi <= 9) baseVol += 0.35;
      }

      if (di === 0 || di === 4) baseVol += 0.1;

      // Deterministic variation instead of Math.random()
      const variation = seededNoise(noiseIdx) * 0.15 - 0.075;
      baseVol += variation;

      data.push({
        day,
        hour,
        volatility: Math.max(0, Math.min(1, baseVol)),
        volume: Math.max(0, Math.min(1, baseVol)),
      });
    });
  });

  return { days, hours, data, isReal: false };
}

function getHeatColor(value: number): string {
  if (value > 0.8) return "bg-[hsl(0,84%,60%)]";
  if (value > 0.65) return "bg-[hsl(25,90%,55%)]";
  if (value > 0.5) return "bg-[hsl(45,90%,50%)]";
  if (value > 0.35) return "bg-[hsl(142,50%,40%)]";
  return "bg-[hsl(217,40%,25%)]";
}

function getHeatOpacity(value: number): string {
  if (value > 0.7) return "opacity-100";
  if (value > 0.5) return "opacity-85";
  if (value > 0.3) return "opacity-70";
  return "opacity-50";
}

const TradingHeatmap = ({ asset, candles }: Props) => {
  const { days, hours, data, isReal } = useMemo(() => {
    // Use real candle data if we have enough (50+ candles with varied hours)
    if (candles && candles.length >= 50) {
      const result = calculateRealHeatmap(candles);
      if (result.isReal) return result;
    }
    return generatePatternHeatmap(asset);
  }, [asset, candles]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-foreground">Heatmap de Horários</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {isReal ? "Volatilidade real calculada" : "Padrão típico de mercado (referência)"}
        </span>
      </div>

      {!isReal && (
        <div className="text-[10px] text-muted-foreground/60 italic mb-3 bg-muted/10 rounded px-2 py-1">
          ⚠️ Heatmap baseado em padrões típicos do tipo de ativo. Dados intradiários insuficientes para cálculo real.
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-2 mb-4 text-[10px] text-muted-foreground">
        <span>Baixa</span>
        <div className="flex gap-0.5">
          <div className="w-4 h-3 rounded-sm bg-[hsl(217,40%,25%)]" />
          <div className="w-4 h-3 rounded-sm bg-[hsl(142,50%,40%)]" />
          <div className="w-4 h-3 rounded-sm bg-[hsl(45,90%,50%)]" />
          <div className="w-4 h-3 rounded-sm bg-[hsl(25,90%,55%)]" />
          <div className="w-4 h-3 rounded-sm bg-[hsl(0,84%,60%)]" />
        </div>
        <span>Alta</span>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="flex">
            <div className="w-10 flex-shrink-0" />
            {hours.map((h) => (
              <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground pb-1 px-0.5">
                {h}
              </div>
            ))}
          </div>

          {days.map((day) => (
            <div key={day} className="flex items-center gap-0.5 mb-0.5">
              <div className="w-10 text-[10px] font-medium text-muted-foreground flex-shrink-0">{day}</div>
              {hours.map((hour) => {
                const cell = data.find((d) => d.day === day && d.hour === hour);
                const vol = cell?.volatility || 0;
                return (
                  <div
                    key={`${day}-${hour}`}
                    className={`flex-1 h-8 rounded-sm ${getHeatColor(vol)} ${getHeatOpacity(vol)} cursor-pointer transition-all hover:scale-110 hover:z-10 relative group`}
                    title={`${day} ${hour}: Volatilidade ${(vol * 100).toFixed(0)}%`}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-background border border-border rounded px-2 py-1 text-[10px] text-foreground whitespace-nowrap z-20 shadow-lg">
                      <div className="font-bold">{day} {hour}</div>
                      <div>Vol: {(vol * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground mt-3">
        🔴 Vermelho = Alta volatilidade/liquidez (oportunidades) • 🔵 Azul = Mercado lateralizado
      </p>
    </motion.div>
  );
};

export default TradingHeatmap;
