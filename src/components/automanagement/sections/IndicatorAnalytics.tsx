import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";

interface IndicatorStat {
  name: string;
  totalSamples: number;
  correctCount: number;
  winRate: number;
  avgWeight: number;
}

export default function IndicatorAnalytics() {
  const { data: indicatorStats, isLoading } = useQuery({
    queryKey: ["indicator-analytics"],
    queryFn: async (): Promise<IndicatorStat[]> => {
      const { data } = await supabase
        .from("management_indicator_performance")
        .select("indicator_name, was_correct, weight_used");

      if (!data || data.length === 0) return [];

      const map = new Map<string, { total: number; correct: number; weightSum: number }>();

      for (const row of data) {
        const entry = map.get(row.indicator_name) || { total: 0, correct: 0, weightSum: 0 };
        entry.total++;
        if (row.was_correct === true) entry.correct++;
        entry.weightSum += Number(row.weight_used) || 1;
        map.set(row.indicator_name, entry);
      }

      return Array.from(map.entries())
        .map(([name, stats]) => ({
          name,
          totalSamples: stats.total,
          correctCount: stats.correct,
          winRate: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
          avgWeight: stats.total > 0 ? stats.weightSum / stats.total : 1,
        }))
        .sort((a, b) => b.winRate - a.winRate);
    },
  });

  if (isLoading) {
    return (
      <Card className="glass border-border/20">
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          Carregando analytics...
        </CardContent>
      </Card>
    );
  }

  const stats = indicatorStats || [];

  if (stats.length === 0) {
    return (
      <Card className="glass border-border/20">
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          Nenhum dado de performance de indicadores disponível. Execute análises e refinamentos para popular os dados.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-border/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Performance por Indicador
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {stats.map((ind) => {
            const isGood = ind.winRate >= 55;
            const isBad = ind.winRate < 40;
            return (
              <div
                key={ind.name}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/5 border border-border/10"
              >
                <div className="flex items-center gap-3">
                  {isGood ? (
                    <TrendingUp className="w-4 h-4 text-[hsl(var(--neon-green))]" />
                  ) : isBad ? (
                    <TrendingDown className="w-4 h-4 text-[hsl(var(--neon-red))]" />
                  ) : (
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-xs font-medium text-foreground">{ind.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {ind.totalSamples} amostras | Peso médio: {ind.avgWeight.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Win Rate Bar */}
                  <div className="w-24 h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isGood
                          ? "bg-[hsl(var(--neon-green))]"
                          : isBad
                          ? "bg-[hsl(var(--neon-red))]"
                          : "bg-primary"
                      }`}
                      style={{ width: `${Math.min(ind.winRate, 100)}%` }}
                    />
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] min-w-[48px] justify-center ${
                      isGood
                        ? "bg-[hsl(var(--neon-green))]/15 text-[hsl(var(--neon-green))]"
                        : isBad
                        ? "bg-[hsl(var(--neon-red))]/15 text-[hsl(var(--neon-red))]"
                        : ""
                    }`}
                  >
                    {ind.winRate.toFixed(0)}%
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
