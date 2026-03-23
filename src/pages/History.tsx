import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, ArrowLeft, TrendingUp, TrendingDown, Minus, Trash2, Clock, Search, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AnalysisResults from "@/components/dashboard/AnalysisResults";
import type { AnalysisResult } from "@/lib/analyze";

interface HistoryRow {
  id: string;
  asset: string;
  timeframe: string;
  signal: string;
  signal_strength_pct: number | null;
  final_confidence_pct: number | null;
  trend: string | null;
  created_at: string;
  full_result: AnalysisResult | null;
}

const SignalIcon = ({ signal }: { signal: string }) => {
  if (signal === "COMPRA") return <TrendingUp className="w-4 h-4 text-[hsl(var(--neon-green))]" />;
  if (signal === "VENDA") return <TrendingDown className="w-4 h-4 text-[hsl(var(--neon-red))]" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
};

const History = () => {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("analysis_history")
      .select("id,asset,timeframe,signal,signal_strength_pct,final_confidence_pct,trend,created_at,full_result")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error(error);
    } else {
      setRows((data as unknown as HistoryRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("analysis_history").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    } else {
      setRows((prev) => prev.filter((r) => r.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast({ title: "Excluído", description: "Análise removida do histórico." });
    }
  };

  const filtered = filter
    ? rows.filter((r) => r.asset.toLowerCase().includes(filter.toLowerCase()))
    : rows;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const getFullResult = (row: HistoryRow): AnalysisResult | null => {
    if (!row.full_result) return null;
    return row.full_result as AnalysisResult;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[200px]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-strong">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Activity className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold text-foreground">Katon AI</span>
              </Link>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">
                  <ArrowLeft className="w-4 h-4" /> Dashboard
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Histórico</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold text-foreground mb-1">Histórico de Análises</h1>
            <p className="text-sm text-muted-foreground">Reexiba qualquer análise exatamente como foi exibida originalmente.</p>
          </motion.div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filtrar por ativo..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              {rows.length === 0 ? "Nenhuma análise registrada ainda." : "Nenhum resultado para o filtro."}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((row, i) => {
                const isExpanded = expandedId === row.id;
                const fullResult = isExpanded ? getFullResult(row) : null;

                return (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="glass rounded-xl border border-border/50 overflow-hidden"
                  >
                    {/* Row header */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <SignalIcon signal={row.signal} />
                        <span className="font-bold text-foreground">{row.asset}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          row.signal === "COMPRA" ? "bg-[hsl(var(--neon-green))]/15 text-[hsl(var(--neon-green))]"
                            : row.signal === "VENDA" ? "bg-[hsl(var(--neon-red))]/15 text-[hsl(var(--neon-red))]"
                            : "bg-muted/30 text-muted-foreground"
                        }`}>
                          {row.signal}
                        </span>
                        <span className="text-xs text-muted-foreground">{row.timeframe}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground hidden sm:block">{formatDate(row.created_at)}</span>
                        {row.final_confidence_pct && (
                          <span className="text-xs font-mono text-primary">{row.final_confidence_pct}%</span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {/* Expanded: full analysis re-display */}
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="border-t border-border/30"
                      >
                        <div className="px-4 py-3 flex items-center justify-between bg-muted/5">
                          <span className="text-xs text-muted-foreground">
                            Análise realizada em {formatDate(row.created_at)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(row.id)}
                            className="text-destructive hover:text-destructive/80 gap-1 text-xs"
                          >
                            <Trash2 className="w-3 h-3" /> Excluir
                          </Button>
                        </div>

                        {fullResult ? (
                          <div className="p-4">
                            <AnalysisResults
                              data={fullResult}
                              onNewAnalysis={() => setExpandedId(null)}
                            />
                          </div>
                        ) : (
                          <div className="p-6 text-center text-muted-foreground text-sm">
                            Dados completos não disponíveis para esta análise (salva antes da atualização).
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default History;
