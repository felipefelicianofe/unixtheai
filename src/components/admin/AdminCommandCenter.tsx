import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity, Shield, Clock, TrendingUp, TrendingDown,
  Target, AlertTriangle, Download, Zap, FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV, exportToJSON } from "@/lib/exportData";
import { toast } from "sonner";

interface DashboardStats {
  totalSignals: number;
  activeSignals: number;
  winRate: number;
  totalWins: number;
  totalLoss: number;
  bestAsset: string;
  worstAsset: string;
}

export default function AdminCommandCenter() {
  // Fetch aggregate stats
  const { data: stats } = useQuery({
    queryKey: ["admin-command-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      const { data: history } = await supabase
        .from("auto_management_history")
        .select("asset, status, virtual_pnl_pct")
        .is("deleted_at", null);

      const rows = history || [];
      const finalized = rows.filter((r) =>
        ["WIN", "WIN_TP1", "WIN_TP2", "WIN_TP3", "LOSS"].includes(r.status)
      );
      const wins = finalized.filter((r) => r.status.startsWith("WIN"));
      const losses = finalized.filter((r) => r.status === "LOSS");
      const active = rows.filter((r) => r.status === "PENDING");

      // Best/Worst asset by win rate
      const assetMap = new Map<string, { wins: number; total: number }>();
      finalized.forEach((r) => {
        const entry = assetMap.get(r.asset) || { wins: 0, total: 0 };
        entry.total++;
        if (r.status.startsWith("WIN")) entry.wins++;
        assetMap.set(r.asset, entry);
      });

      let bestAsset = "—";
      let worstAsset = "—";
      let bestWR = -1;
      let worstWR = 101;
      assetMap.forEach((v, k) => {
        if (v.total < 3) return;
        const wr = (v.wins / v.total) * 100;
        if (wr > bestWR) { bestWR = wr; bestAsset = k; }
        if (wr < worstWR) { worstWR = wr; worstAsset = k; }
      });

      return {
        totalSignals: rows.length,
        activeSignals: active.length,
        winRate: finalized.length > 0 ? (wins.length / finalized.length) * 100 : 0,
        totalWins: wins.length,
        totalLoss: losses.length,
        bestAsset: bestAsset !== "—" ? `${bestAsset} (${bestWR.toFixed(0)}%)` : "—",
        worstAsset: worstAsset !== "—" ? `${worstAsset} (${worstWR.toFixed(0)}%)` : "—",
      };
    },
    refetchInterval: 30000,
  });

  // Fetch recent audit log
  const { data: auditLog } = useQuery({
    queryKey: ["admin-audit-log"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Fetch active configs count
  const { data: configStats } = useQuery({
    queryKey: ["admin-config-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("auto_management_configs")
        .select("asset, is_active");
      const active = (data || []).filter((c) => c.is_active);
      return { total: (data || []).length, active: active.length };
    },
  });

  // Daily reports
  const { data: dailyReports } = useQuery({
    queryKey: ["admin-daily-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_reports")
        .select("*")
        .order("report_date", { ascending: false })
        .limit(7);
      return data || [];
    },
  });

  const handleExportAudit = () => {
    if (!auditLog || auditLog.length === 0) {
      toast.error("Nenhum log para exportar");
      return;
    }
    exportToCSV(
      auditLog.map((l) => ({
        data: new Date(l.created_at).toLocaleString("pt-BR"),
        acao: l.action,
        detalhes: JSON.stringify(l.details),
      })),
      `audit_log_${new Date().toISOString().slice(0, 10)}`
    );
    toast.success("Audit log exportado!");
  };

  const handleGenerateDigest = async () => {
    toast.info("Gerando relatório diário...");
    try {
      const { data, error } = await supabase.functions.invoke("generate-daily-digest");
      if (error) throw error;
      toast.success("Relatório diário gerado com sucesso!");
    } catch (err) {
      toast.error("Erro ao gerar relatório");
      console.error(err);
    }
  };

  const s = stats || {
    totalSignals: 0,
    activeSignals: 0,
    winRate: 0,
    totalWins: 0,
    totalLoss: 0,
    bestAsset: "—",
    worstAsset: "—",
  };

  const metricCards = [
    { label: "Total Sinais", value: s.totalSignals, icon: Target, color: "text-primary" },
    { label: "Ativos", value: s.activeSignals, icon: Zap, color: "text-[hsl(var(--neon-green))]" },
    { label: "Win Rate", value: `${s.winRate.toFixed(1)}%`, icon: TrendingUp, color: "text-[hsl(var(--neon-green))]" },
    { label: "Wins", value: s.totalWins, icon: TrendingUp, color: "text-[hsl(var(--neon-green))]" },
    { label: "Losses", value: s.totalLoss, icon: TrendingDown, color: "text-[hsl(var(--neon-red))]" },
    { label: "Configs Ativas", value: configStats?.active || 0, icon: Activity, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metricCards.map((m) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="glass border-border/20">
              <CardContent className="p-4 text-center">
                <m.icon className={`w-5 h-5 mx-auto mb-2 ${m.color}`} />
                <p className="text-2xl font-black text-foreground">{m.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{m.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Best/Worst + Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass border-border/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Melhor Ativo</p>
            <p className="text-lg font-bold text-[hsl(var(--neon-green))]">{s.bestAsset}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Pior Ativo</p>
            <p className="text-lg font-bold text-[hsl(var(--neon-red))]">{s.worstAsset}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/20">
          <CardContent className="p-4 flex flex-col gap-2">
            <Button size="sm" variant="outline" onClick={handleGenerateDigest} className="gap-2 text-xs">
              <FileText className="w-3 h-3" /> Gerar Resumo Diário
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportAudit} className="gap-2 text-xs">
              <Download className="w-3 h-3" /> Exportar Audit Log
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Daily Reports */}
      {dailyReports && dailyReports.length > 0 && (
        <Card className="glass border-border/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Relatórios Diários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {dailyReports.map((r) => (
                <div key={r.id} className="p-3 rounded-lg bg-muted/10 border border-border/20">
                  <p className="text-xs font-bold text-foreground mb-1">
                    {new Date(r.report_date + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <span className="text-muted-foreground">Sinais: </span>
                      <span className="text-foreground font-medium">{r.total_signals}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">WR: </span>
                      <span className="text-[hsl(var(--neon-green))] font-medium">
                        {Number(r.win_rate).toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">W/L: </span>
                      <span className="text-foreground font-medium">
                        {r.total_wins}/{r.total_losses}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Log */}
      <Card className="glass border-border/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Audit Log (Últimas 20 ações)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-64">
            {(!auditLog || auditLog.length === 0) ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma ação registrada</p>
            ) : (
              <div className="space-y-2">
                {auditLog.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/5 border border-border/10">
                    <Clock className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{log.action}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    {log.details && Object.keys(log.details as object).length > 0 && (
                      <Badge variant="outline" className="text-[9px] shrink-0">
                        {Object.keys(log.details as object).length} campos
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
