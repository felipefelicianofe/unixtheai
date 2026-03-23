import React, { useState } from "react";
import { motion } from "framer-motion";
import { Database, Plus, Play, Info, CheckCircle2, XCircle, ChevronDown, ChevronUp, Trash2, TrendingUp, TrendingDown, Clock, Target, RefreshCw, Brain, Sparkles, Loader2, RotateCcw, ArrowUp, ArrowDown, Minus, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import AppNavBar from "@/components/AppNavBar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import AnalysisResults from "@/components/dashboard/AnalysisResults";
import type { AnalysisResult } from "@/lib/analyze";
import type { Database as SupabaseDatabase } from "@/integrations/supabase/types";

export type TestConfigRow = SupabaseDatabase['public']['Tables']['auto_analysis_configs']['Row'];
export type TestHistoryRow = SupabaseDatabase['public']['Tables']['auto_analysis_history']['Row'] & {
  auto_analysis_configs?: {
    asset: string;
    timeframe: string;
    analysis_period_minutes: number;
    leverage: number;
  } | null;
};
export type WeightsRow = SupabaseDatabase['public']['Tables']['refinement_weights']['Row'];
export type LogsRow = SupabaseDatabase['public']['Tables']['refinement_log']['Row'];

const AVAILABLE_ASSETS = [
  "BTCUSDT", "PAXGUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT", "DOTUSDT", "AVAXUSDT", 
  "DOGEUSDT", "XRPUSDT", "LINKUSDT", "MATICUSDT", "BNBUSDT", "ATOMUSDT", 
  "NEARUSDT", "ARBUSDT", "OPUSDT", "SUIUSDT", "APTUSDT", "UNIUSDT", 
  "AAVEUSDT", "LTCUSDT"
];

const TIMEFRAMES = ["15m", "30m", "1h", "4h", "1d"];

// Helper: smart price formatting based on magnitude
function formatPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  const abs = Math.abs(num);
  if (abs >= 10000) return num.toFixed(1);
  if (abs >= 1000) return num.toFixed(1);
  if (abs >= 100) return num.toFixed(2);
  if (abs >= 1) return num.toFixed(4);
  return num.toFixed(6);
}

// Helper: format status badge with close reason context
function StatusBadge({ status, closeReason, closedAt }: { status: string; closeReason?: string | null; closedAt?: string | null }) {
  // Determine if this is a finalized entry that closed via breakeven
  const isBEClose = closeReason === "BREAKEVEN";
  const isFinalized = !!closedAt;

  switch (status) {
    case "PENDING":
      return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 bg-yellow-500/5">⏳ Aguardando</Badge>;
    case "NEUTRAL":
      return <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 bg-muted/10">➡️ Neutro</Badge>;
    case "WIN_TP1":
      if (isBEClose) {
        return <Badge variant="outline" className="text-amber-400 border-amber-400/30 bg-amber-400/10">🎯 TP1 → BE</Badge>;
      }
      return <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10">{isFinalized ? '🎯 Win TP1' : '🎯 Win TP1'}</Badge>;
    case "WIN_TP2":
      if (isBEClose) {
        return <Badge variant="outline" className="text-amber-400 border-amber-400/30 bg-amber-400/10">🎯🎯 TP2 → BE</Badge>;
      }
      return <Badge variant="outline" className="text-green-400 border-green-400/30 bg-green-400/10">🎯🎯 Win TP2</Badge>;
    case "WIN_TP3":
    case "WIN":
      return <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10">🏆 Win TP3</Badge>;
    case "LOSS":
      return <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10">❌ Loss</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// Helper: format close reason for display
function formatCloseReason(reason: string | null | undefined): string {
  if (!reason) return '';
  switch (reason) {
    case 'BREAKEVEN': return 'Voltou ao Breakeven';
    case 'TP3': return 'Alvo TP3 atingido';
    case 'SL': return 'Stop Loss atingido';
    case 'MANUAL': return 'Fechamento manual';
    default: return reason;
  }
}

// Helper: distance progress bar
function DistanceBar({ label, distancePct, isHit, hitTime, color }: { 
  label: string; distancePct: number | null; isHit: boolean; hitTime?: string | null; color: string 
}) {
  if (isHit) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className={`font-semibold w-8 ${color}`}>{label}</span>
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${color === 'text-green-500' ? 'bg-green-500' : color === 'text-emerald-400' ? 'bg-emerald-400' : 'bg-red-500'}`} style={{ width: '100%' }} />
        </div>
        <CheckCircle2 className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-muted-foreground text-[10px] min-w-[60px]">
          {hitTime ? new Date(hitTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Hit'}
        </span>
      </div>
    );
  }

  if (distancePct === null || distancePct === undefined) return null;

  // For targets not yet hit: show how close we are (100% = at target, 0% = at entry)
  // distancePct > 0 means still need to travel that % to reach target
  // distancePct <= 0 means already passed (should be hit)
  const progressValue = Math.max(0, Math.min(100, 100 - Math.abs(distancePct) * 10));

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`font-semibold w-8 ${color}`}>{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${distancePct <= 0 ? 'bg-green-500' : color === 'text-red-500' ? 'bg-red-500/60' : 'bg-primary/40'}`} 
          style={{ width: `${progressValue}%` }} 
        />
      </div>
      <span className={`text-[10px] min-w-[55px] text-right ${distancePct <= 0 ? 'text-green-500 font-bold' : 'text-muted-foreground'}`}>
        {distancePct > 0 ? `${distancePct.toFixed(2)}%` : distancePct <= 0 ? 'Atingido!' : '-'}
      </span>
    </div>
  );
}

const AutoTesteAdmin = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [showNeutros, setShowNeutros] = useState<boolean>(() => {
    const stored = localStorage.getItem('autoteste-show-neutros');
    return stored !== null ? stored === 'true' : true;
  });

  const handleToggleNeutros = (value: boolean) => {
    setShowNeutros(value);
    localStorage.setItem('autoteste-show-neutros', String(value));
  };
  const [backtestDetailLog, setBacktestDetailLog] = useState<LogsRow | null>(null);
  
  const [newAsset, setNewAsset] = useState("");
  const [newTimeframe, setNewTimeframe] = useState("");
  const [newPeriod, setNewPeriod] = useState("45");
  const [newLeverage, setNewLeverage] = useState("1");

  const toggleAssetFilter = (asset: string) => {
    setSelectedAssets(prev => {
      const next = new Set(prev);
      if (next.has(asset)) next.delete(asset);
      else next.add(asset);
      return next;
    });
  };

  // Fetch Configs
  const { data: configs, isLoading: loadingConfigs } = useQuery({
    queryKey: ['auto-analysis-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_analysis_configs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as TestConfigRow[];
    }
  });

  // Fetch History (non-deleted only)
  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['auto-analysis-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_analysis_history')
        .select(`*, auto_analysis_configs (asset, timeframe, analysis_period_minutes, leverage)`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as unknown) as TestHistoryRow[];
    },
    refetchInterval: 60000,
  });

  // Fetch Deleted History (trash)
  const { data: deletedHistory, isLoading: loadingDeleted } = useQuery({
    queryKey: ['deleted-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_analysis_history')
        .select(`id, asset, timeframe, signal, status, created_at, deleted_at`)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as unknown) as TestHistoryRow[];
    },
  });

  // Fetch Refinement Weights
  const { data: refinementWeights, isLoading: loadingWeights } = useQuery({
    queryKey: ['refinement-weights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('refinement_weights')
        .select('*')
        .order('win_rate', { ascending: false });
      if (error) throw error;
      return data as WeightsRow[];
    }
  });

  // Fetch Refinement Logs
  const { data: refinementLogs } = useQuery({
    queryKey: ['refinement-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('refinement_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as LogsRow[];
    }
  });

  // Manual verify trigger
  const verifyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('verify-analyses-results');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-analysis-history'] });
      toast.success("Reverificação concluída!");
    },
    onError: (err: unknown) => toast.error("Erro na verificação: " + (err instanceof Error ? err.message : "Erro desconhecido")),
  });

  // Auto-Refine mutation
  const refineMutation = useMutation({
    mutationFn: async (mode: string) => {
      const { data, error } = await supabase.functions.invoke('auto-refine', { body: { mode } });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['refinement-weights'] });
      queryClient.invalidateQueries({ queryKey: ['refinement-logs'] });
      toast.success(`Auto-Refinamento concluído! Extraídos: ${data?.extracted || 0}, Calibrados: ${data?.calibrated || 0}`);
    },
    onError: (err: unknown) => toast.error("Erro no refinamento: " + (err instanceof Error ? err.message : "Erro desconhecido")),
  });

  // Mutations
  const createConfigMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não logado");
      const { error } = await supabase.from('auto_analysis_configs').insert({
        asset: newAsset.toUpperCase(),
        timeframe: newTimeframe,
        analysis_period_minutes: parseInt(newPeriod),
        leverage: parseInt(newLeverage) || 1,
        admin_id: user.id,
        is_active: true,
        last_run_at: null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['auto-analysis-configs'] });
      toast.success("Ação criada! Iniciando primeira análise...");
      setIsCreating(false);
      setNewAsset("");
      setNewTimeframe("");
      try {
        await supabase.functions.invoke('run-auto-analyses');
        queryClient.invalidateQueries({ queryKey: ['auto-analysis-history'] });
      } catch (e) {
        console.error("Erro ao engatilhar run-auto-analyses", e);
      }
    },
    onError: (err: unknown) => toast.error("Erro: " + (err instanceof Error ? err.message : String(err))),
  });

  const toggleConfigMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string, is_active: boolean }) => {
      const { error } = await supabase
        .from('auto_analysis_configs')
        .update({ is_active, ...(is_active ? { last_run_at: null } : {}) })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['auto-analysis-configs'] });
      toast.success(`Configuração ${variables.is_active ? 'ativada' : 'desativada'}.`);
      if (variables.is_active) {
        try {
          await supabase.functions.invoke('run-auto-analyses');
          queryClient.invalidateQueries({ queryKey: ['auto-analysis-history'] });
        } catch (e) { console.error(e); }
      }
    },
    onError: (err: unknown) => toast.error("Erro: " + (err instanceof Error ? err.message : String(err))),
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('auto_analysis_configs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-analysis-configs'] });
      toast.success("Configuração excluída!");
    },
    onError: (err: unknown) => toast.error("Erro: " + (err instanceof Error ? err.message : String(err))),
  });

  const deleteHistoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('auto_analysis_history').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-analysis-history'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-history'] });
      toast.success("Análise movida para lixeira!");
    },
    onError: (err: unknown) => toast.error("Erro: " + (err instanceof Error ? err.message : String(err))),
  });

  const restoreHistoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('auto_analysis_history').update({ deleted_at: null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-analysis-history'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-history'] });
      toast.success("Análise restaurada!");
    },
    onError: (err: unknown) => toast.error("Erro ao restaurar: " + (err instanceof Error ? err.message : String(err))),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset || !newTimeframe || !newPeriod) {
      toast.error("Preencha todos os campos.");
      return;
    }
    createConfigMutation.mutate();
  };

  // Filtered history based on selected assets
  const filteredHistory = selectedAssets.size > 0
    ? history?.filter((h) => selectedAssets.has(h.asset)) || []
    : history || [];

  // Display list: optionally hide neutrals
  const displayedHistory = showNeutros
    ? filteredHistory
    : filteredHistory.filter((h) => !(h.status === 'NEUTRAL' || ((h.signal === 'NEUTRO' || h.signal === 'NEUTRAL') && h.status === 'PENDING')));

  // Exclude NEUTRAL and PENDING-neutral from actionable metrics
  const isNeutralEntry = (h) => h.status === 'NEUTRAL' || ((h.signal === 'NEUTRO' || h.signal === 'NEUTRAL') && h.status === 'PENDING');
  const actionableHistory = filteredHistory.filter((h) => !isNeutralEntry(h));
  const totalNeutral = filteredHistory.filter((h) => isNeutralEntry(h)).length;
  const totalPending = filteredHistory.filter((h) => h.status === 'PENDING' && !isNeutralEntry(h)).length;

  // Stats: only finalized actionable entries (WIN* + LOSS)
  const totalFinalized = actionableHistory.filter((h) => h.status?.startsWith('WIN') || h.status === 'LOSS').length;
  const totalWins = actionableHistory.filter((h) => h.status?.startsWith('WIN')).length;
  const totalLoss = actionableHistory.filter((h) => h.status === 'LOSS').length;
  const winRate = totalWins + totalLoss > 0 ? (totalWins / (totalWins + totalLoss)) * 100 : 0;

  // UL (Unidades Lucrativas): TP1=+1, TP2=+2, TP3=+3, LOSS=-1 — NEUTRAL excluded
  const totalUL = actionableHistory.reduce((sum: number, h: TestHistoryRow) => {
    if (h.status === 'WIN_TP1') return sum + 1;
    if (h.status === 'WIN_TP2') return sum + 2;
    if (h.status === 'WIN_TP3' || h.status === 'WIN') return sum + 3;
    if (h.status === 'LOSS') return sum - 1;
    return sum;
  }, 0);

  return (
    <div className="min-h-screen bg-background">
      <AppNavBar />
      
      <main className="relative z-10 pt-24 pb-24 px-4 max-w-7xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-foreground">AutoTeste Avançado</h1>
          <p className="text-muted-foreground mt-2">
            Forward Testing autônomo com verificação em tempo real de alvos.
          </p>
        </motion.div>

        {/* Dashboard Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="glass-panel border-primary/20 bg-background/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{winRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">{totalWins}W / {totalLoss}L</p>
            </CardContent>
          </Card>
          <Card className="glass-panel border-muted bg-background/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{totalFinalized}</div>
              {(totalNeutral > 0 || totalPending > 0) && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {totalPending > 0 && `⏳ ${totalPending} pendentes`}
                  {totalPending > 0 && totalNeutral > 0 && ' · '}
                  {totalNeutral > 0 && `➡️ ${totalNeutral} neutros`}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="glass-panel border-green-500/20 bg-background/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Wins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">{totalWins}</div>
              <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                <span>TP1: {actionableHistory.filter((h) => h.status === 'WIN_TP1').length}</span>
                <span>TP2: {actionableHistory.filter((h) => h.status === 'WIN_TP2').length}</span>
                <span>TP3: {actionableHistory.filter((h) => h.status === 'WIN_TP3' || h.status === 'WIN').length}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-panel border-red-500/20 bg-background/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" /> Losses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">{totalLoss}</div>
            </CardContent>
          </Card>
          <Card className={`glass-panel bg-background/50 ${totalUL >= 0 ? 'border-emerald-400/20' : 'border-red-500/20'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> UL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${totalUL > 0 ? 'text-emerald-400' : totalUL < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                {totalUL > 0 ? `+${totalUL}` : totalUL}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Unidades Lucrativas</p>
            </CardContent>
          </Card>
        </div>

        {/* Win Rate per Asset */}
        <Card className="glass-panel border-muted bg-background/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate por Ativo</CardTitle>
              {selectedAssets.size > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedAssets(new Set())}>
                  Limpar filtros ({selectedAssets.size})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Array.from(new Set(history?.map((h) => h.asset) || [])).map(asset => {
                const assetStr = asset as string;
                const assetAll = history?.filter((h) => h.asset === asset) || [];
                const assetActionable = assetAll.filter((h) => !isNeutralEntry(h));
                const assetWins = assetActionable.filter((h) => h.status?.startsWith('WIN')).length;
                const assetLosses = assetActionable.filter((h) => h.status === 'LOSS').length;
                const assetNeutrals = assetAll.filter((h) => isNeutralEntry(h)).length;
                const totalFinished = assetWins + assetLosses;
                const assetWinRate = totalFinished > 0 ? (assetWins / totalFinished) * 100 : 0;
                const assetUL = assetActionable.reduce((sum: number, h: TestHistoryRow) => {
                  if (h.status === 'WIN_TP1') return sum + 1;
                  if (h.status === 'WIN_TP2') return sum + 2;
                  if (h.status === 'WIN_TP3' || h.status === 'WIN') return sum + 3;
                  if (h.status === 'LOSS') return sum - 1;
                  return sum;
                }, 0);
                const isActive = selectedAssets.has(assetStr);
                const noFilter = selectedAssets.size === 0;

                return (
                  <motion.div
                    key={assetStr}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleAssetFilter(assetStr)}
                    className={`flex flex-col gap-1 p-3 rounded-lg min-w-[120px] cursor-pointer select-none transition-all duration-200 border ${
                      isActive
                        ? 'border-primary bg-primary/10 shadow-[0_0_15px_hsl(var(--primary)/0.3)] ring-1 ring-primary/40'
                        : noFilter
                          ? 'border-transparent bg-secondary/30 hover:border-muted-foreground/20 hover:bg-secondary/50'
                          : 'border-transparent bg-secondary/10 opacity-40 hover:opacity-70'
                    }`}
                  >
                    <span className={`text-xs font-semibold transition-colors ${isActive ? 'text-primary' : ''}`}>{assetStr}</span>
                    <span className={`text-lg font-bold ${assetWinRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                      {totalFinished > 0 ? `${assetWinRate.toFixed(1)}%` : '-'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">({assetWins}W / {assetLosses}L{assetNeutrals > 0 ? ` / ${assetNeutrals}N` : ''})</span>
                    <span className={`text-[10px] font-semibold ${assetUL > 0 ? 'text-emerald-400' : assetUL < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      UL: {assetUL > 0 ? `+${assetUL}` : assetUL}
                    </span>
                  </motion.div>
                );
              })}
              {(!history || history.length === 0) && (
                <span className="text-xs text-muted-foreground">Nenhum dado disponível.</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="configs" className="w-full">
          <TabsList className="mb-6 grid w-full md:w-[600px] grid-cols-4">
            <TabsTrigger value="configs">Configurações</TabsTrigger>
            <TabsTrigger value="history">Histórico & Verificação</TabsTrigger>
            <TabsTrigger value="refinement">🧠 Auto-Refinamento</TabsTrigger>
            <TabsTrigger value="trash">🗑️ Lixeira{deletedHistory && deletedHistory.length > 0 ? ` (${deletedHistory.length})` : ''}</TabsTrigger>
          </TabsList>

          <TabsContent value="configs" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Configurações Ativas</h2>
              <Button onClick={() => setIsCreating(!isCreating)} variant="outline">
                <Plus className="w-4 h-4 mr-2" /> Nova Ação
              </Button>
            </div>

            {isCreating && (
              <Card className="glass-panel border-primary/30">
                <CardHeader>
                  <CardTitle className="text-lg">Nova Ação de AutoAnálise</CardTitle>
                  <CardDescription>Defina o ativo e o período.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="space-y-2">
                      <Label>Ativo</Label>
                      <Select value={newAsset} onValueChange={setNewAsset}>
                        <SelectTrigger className="bg-background/50"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <div className="max-h-[200px] overflow-y-auto">
                            {AVAILABLE_ASSETS.map(asset => (
                              <SelectItem key={asset} value={asset}>{asset}</SelectItem>
                            ))}
                          </div>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Timeframe</Label>
                      <Select value={newTimeframe} onValueChange={setNewTimeframe}>
                        <SelectTrigger className="bg-background/50"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {TIMEFRAMES.map(tf => (
                            <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Período (minutos)</Label>
                      <Input type="number" value={newPeriod} onChange={e => setNewPeriod(e.target.value)} className="bg-background/50" />
                    </div>
                    <div className="space-y-2">
                      <Label>Alavancagem (x)</Label>
                      <Input type="number" value={newLeverage} onChange={e => setNewLeverage(e.target.value)} min="1" max="200" className="bg-background/50" placeholder="Ex: 150" />
                    </div>
                    <Button type="submit" disabled={createConfigMutation.isPending} className="w-full">Salvar</Button>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {loadingConfigs ? (
                <div className="col-span-3 text-center py-8 text-muted-foreground">Carregando...</div>
              ) : configs?.length === 0 ? (
                <div className="col-span-3 text-center py-8 border border-dashed border-border rounded-lg text-muted-foreground">
                  Nenhuma configuração criada.
                </div>
              ) : (
                configs?.map((config: TestConfigRow) => (
                  <Card key={config.id} className={`glass-panel border-muted bg-background/50 transition-colors ${config.is_active ? 'border-l-4 border-l-primary' : 'opacity-70'} relative group`}>
                    <Button variant="ghost" size="icon"
                      className="absolute top-2 right-2 h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 hover:bg-red-500/10"
                      onClick={() => deleteConfigMutation.mutate(config.id)}
                      disabled={deleteConfigMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl flex items-center gap-2">
                        {config.asset}
                        <Badge variant="outline" className="text-xs">{config.timeframe}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Play className="w-4 h-4 text-primary" />
                          <span>A cada {config.analysis_period_minutes} min</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-primary" />
                          <span>Alavancagem: <strong className="text-foreground">{config.leverage || 1}x</strong></span>
                        </div>
                        <div className="flex items-center justify-between mt-1 border-t border-border/50 pt-3">
                          <span>{config.is_active ? '✅ Ativo' : '❌ Pausado'}</span>
                          <Switch checked={config.is_active} onCheckedChange={(checked) => toggleConfigMutation.mutate({ id: config.id, is_active: checked })} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card className="glass-panel border-muted bg-background/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Histórico & Verificação em Tempo Real</CardTitle>
                  <CardDescription>
                    {selectedAssets.size > 0 
                      ? `Filtrando: ${Array.from(selectedAssets).join(', ')}`
                      : 'Monitoramento de alvos com preço atual, distância % e P&L virtual.'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={showNeutros} onCheckedChange={handleToggleNeutros} id="show-neutros" />
                    <Label htmlFor="show-neutros" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                      Exibir Neutros
                    </Label>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${verifyMutation.isPending ? 'animate-spin' : ''}`} />
                    Reverificar Agora
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loadingHistory ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                   ) : displayedHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {selectedAssets.size > 0 ? 'Nenhum registro para os ativos selecionados.' : !showNeutros ? 'Nenhum registro (neutros ocultos).' : 'Nenhum registro.'}
                    </div>
                  ) : (
                    displayedHistory.map((h) => {
                      const isExpanded = expandedRowId === h.id;
                      const isNeutral = h.status === "NEUTRAL" || h.signal === "NEUTRO" || h.signal === "NEUTRAL";
                      const isLong = !isNeutral && (h.signal === "COMPRA" || h.signal === "BUY" || h.signal === "LONG" || (h.take_profit_1 && h.entry_price && h.take_profit_1 > h.entry_price));
                      const leverage = h.auto_analysis_configs?.leverage || 1;
                      const rawPnl = h.virtual_pnl_pct;
                      const pnl = rawPnl !== null && rawPnl !== undefined ? rawPnl * leverage : null;
                      const isPending = h.status === "PENDING";
                      const isWin = h.status?.startsWith("WIN");
                      const isLoss = h.status === "LOSS";

                      return (
                        <motion.div
                          key={h.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`rounded-lg border p-4 transition-colors ${
                            isNeutral ? 'border-muted-foreground/15 bg-muted/5 opacity-80' :
                            isWin ? 'border-green-500/20 bg-green-500/5' : 
                            isLoss ? 'border-red-500/20 bg-red-500/5' : 
                            'border-border bg-background/50'
                          }`}
                        >
                          {/* Header row */}
                          <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedRowId(isExpanded ? null : h.id)}>
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-lg">{h.asset}</span>
                                  <Badge variant="secondary" className="text-[10px]">{h.timeframe}</Badge>
                                  {isNeutral ? (
                                    <Minus className="w-4 h-4 text-muted-foreground" />
                                  ) : isLong ? (
                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <TrendingDown className="w-4 h-4 text-red-500" />
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(h.created_at).toLocaleString('pt-BR')}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              {/* Virtual P&L — hidden for NEUTRAL */}
                              {!isNeutral && pnl !== null && pnl !== undefined && isPending && (
                                <div className={`text-right ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  <div className="text-sm font-bold">{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%</div>
                                  <div className="text-[10px] text-muted-foreground">P&L {leverage > 1 ? `${leverage}x` : 'Virtual'}</div>
                                  {leverage > 1 && rawPnl !== null && (
                                    <div className="text-[9px] text-muted-foreground/60">({rawPnl >= 0 ? '+' : ''}{rawPnl.toFixed(2)}% s/ alav.)</div>
                                  )}
                                </div>
                              )}

                              {/* Current price — hidden for NEUTRAL */}
                              {!isNeutral && h.current_price && isPending && (
                                <div className="text-right">
                                  <div className="text-sm font-semibold">${formatPrice(h.current_price)}</div>
                                  <div className="text-[10px] text-muted-foreground">Preço Atual</div>
                                </div>
                              )}

                              {/* Neutral reason summary */}
                              {isNeutral && h.executive_summary && (
                                <div className="text-right max-w-[200px]">
                                  <div className="text-[10px] text-muted-foreground line-clamp-2">{h.executive_summary}</div>
                                </div>
                              )}

                              <StatusBadge status={h.status} closeReason={h.close_reason} closedAt={h.closed_at} />

                              <div className="flex items-center gap-1">
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500"
                                  onClick={(e) => { e.stopPropagation(); deleteHistoryMutation.mutate(h.id); }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Price levels & distance bars — only for actionable signals */}
                          {!isNeutral && (
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Left: Price levels */}
                              <div className="grid grid-cols-4 gap-2 text-xs">
                                <div className="flex flex-col p-2 rounded bg-muted/20">
                                  <span className="text-muted-foreground">Entrada</span>
                                  <span className="font-semibold">{formatPrice(h.entry_price)}</span>
                                </div>
                                <div className="flex flex-col p-2 rounded bg-green-500/10">
                                  <span className="text-green-500">TP1</span>
                                  <span className="font-semibold">{formatPrice(h.take_profit_1)}</span>
                                </div>
                                <div className="flex flex-col p-2 rounded bg-green-500/10">
                                  <span className="text-green-500">TP2</span>
                                  <span className="font-semibold">{h.take_profit_2 ? formatPrice(h.take_profit_2) : '-'}</span>
                                </div>
                                <div className="flex flex-col p-2 rounded bg-red-500/10">
                                  <span className="text-red-500">SL</span>
                                  <span className="font-semibold">{formatPrice(h.stop_loss)}</span>
                                </div>
                              </div>

                              {/* Right: Distance bars */}
                              <div className="space-y-1.5">
                                <DistanceBar label="TP1" distancePct={h.distance_tp1_pct} isHit={!!h.tp1_hit_time} hitTime={h.tp1_hit_time} color="text-emerald-400" />
                                <DistanceBar label="TP2" distancePct={h.distance_tp2_pct} isHit={!!h.tp2_hit_time} hitTime={h.tp2_hit_time} color="text-green-400" />
                                <DistanceBar label="TP3" distancePct={h.distance_tp3_pct} isHit={!!h.tp3_hit_time} hitTime={h.tp3_hit_time} color="text-green-500" />
                                <DistanceBar label="SL" distancePct={h.distance_sl_pct} isHit={!!h.loss_hit_time} hitTime={h.loss_hit_time} color="text-red-500" />
                              </div>
                            </div>
                          )}

                          {/* Neutral: show simplified info */}
                          {isNeutral && (
                            <div className="mt-3 p-3 rounded-lg bg-muted/10 border border-muted-foreground/10">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Minus className="w-3.5 h-3.5" />
                                <span className="font-medium">Sinal Neutro — Sem operação sugerida</span>
                              </div>
                              {h.final_confidence_pct && (
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  Confiança: {h.final_confidence_pct}% | Tendência: {h.trend || '—'}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Close reason info — shown for finalized entries */}
                          {!isNeutral && h.closed_at && h.close_reason && (
                            <div className={`mt-2 flex items-center gap-2 text-[10px] px-3 py-1.5 rounded-md ${
                              h.close_reason === 'BREAKEVEN' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' :
                              h.close_reason === 'TP3' ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
                              h.close_reason === 'SL' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                              'bg-muted/20 border border-border text-muted-foreground'
                            }`}>
                              <span className="font-semibold">
                                {h.close_reason === 'BREAKEVEN' ? '🔄' : h.close_reason === 'TP3' ? '🏆' : h.close_reason === 'SL' ? '🛑' : '📌'}
                              </span>
                              <span>Fechado: <strong>{formatCloseReason(h.close_reason)}</strong></span>
                              <span className="text-muted-foreground">—</span>
                              <span className="text-muted-foreground">
                                {new Date(h.closed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}

                          {/* Verification timestamp */}
                          {h.last_verified_at && !isNeutral && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              Última verificação: {new Date(h.last_verified_at).toLocaleString('pt-BR')}
                            </div>
                          )}

                          {/* Expanded: full analysis */}
                          {isExpanded && h.full_result && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-4 pt-4 border-t border-border/50">
                              <AnalysisResults data={h.full_result as unknown as AnalysisResult} onNewAnalysis={() => setExpandedRowId(null)} />
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Refinement Tab */}
          <TabsContent value="refinement" className="space-y-6">
            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => refineMutation.mutate("full")} disabled={refineMutation.isPending} className="gap-2">
                {refineMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                {refineMutation.isPending ? "Processando..." : "Extrair & Calibrar"}
              </Button>
              <Button onClick={() => refineMutation.mutate("extract")} disabled={refineMutation.isPending} variant="outline" className="gap-2">
                <Sparkles className="w-4 h-4" /> Apenas Extrair
              </Button>
              <Button onClick={() => refineMutation.mutate("calibrate")} disabled={refineMutation.isPending} variant="outline" className="gap-2">
                <Target className="w-4 h-4" /> Apenas Calibrar
              </Button>
              <Button onClick={() => {
                if (confirm("Isso irá resetar TODOS os dados de refinamento. Continuar?")) {
                  refineMutation.mutate("reset");
                }
              }} disabled={refineMutation.isPending} variant="ghost" className="gap-2 text-destructive hover:text-destructive">
                <RotateCcw className="w-4 h-4" /> Reset para Default
              </Button>
            </div>

            {/* Refinement Stats Summary */}
            {refinementWeights && refinementWeights.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="glass-panel border-primary/20 bg-background/50">
                  <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground">Indicadores Monitorados</div>
                    <div className="text-2xl font-bold text-foreground">{refinementWeights.length}</div>
                  </CardContent>
                </Card>
                <Card className="glass-panel border-green-500/20 bg-background/50">
                  <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><ArrowUp className="w-3 h-3 text-green-500" /> Boosted</div>
                    <div className="text-2xl font-bold text-green-500">
                      {refinementWeights.filter((w: WeightsRow) => w.trend === 'IMPROVING').length}
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-panel border-red-500/20 bg-background/50">
                  <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDown className="w-3 h-3 text-red-500" /> Reduced</div>
                    <div className="text-2xl font-bold text-red-500">
                      {refinementWeights.filter((w: WeightsRow) => w.trend === 'DEGRADING').length}
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-panel border-muted bg-background/50">
                  <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground">WR Médio Indicadores</div>
                    <div className="text-2xl font-bold text-foreground">
                      {(refinementWeights.reduce((sum: number, w: WeightsRow) => sum + (w.win_rate || 0), 0) / refinementWeights.length).toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Indicator Weights Accordion */}
            <Card className="glass-panel border-muted bg-background/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  Pesos dos Indicadores (Calibrados)
                </CardTitle>
                <CardDescription>
                  Performance de cada indicador com base nos resultados reais do AutoTeste.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingWeights ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : !refinementWeights || refinementWeights.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum dado de refinamento ainda.</p>
                    <p className="text-xs mt-1">Clique "Extrair & Calibrar" para analisar o histórico existente.</p>
                  </div>
                ) : (() => {
                  // Group weights by asset+timeframe
                  const groups = new Map<string, WeightsRow[]>();
                  refinementWeights.forEach((w: WeightsRow) => {
                    const key = `${w.asset} / ${w.timeframe}`;
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push(w);
                  });

                  return (
                    <Accordion type="multiple" className="w-full space-y-2">
                      {Array.from(groups.entries()).map(([groupKey, items]) => {
                        const avgWr = items.reduce((s: number, w: WeightsRow) => s + (w.win_rate || 0), 0) / items.length;
                        const improving = items.filter((w: WeightsRow) => w.trend === 'IMPROVING').length;
                        const degrading = items.filter((w: WeightsRow) => w.trend === 'DEGRADING').length;
                        const wrColor = avgWr >= 65 ? 'text-green-500' : avgWr < 40 ? 'text-red-500' : 'text-foreground';

                        return (
                          <AccordionItem key={groupKey} value={groupKey} className="border border-muted/30 rounded-lg overflow-hidden bg-background/30">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/10">
                              <div className="flex items-center gap-3 w-full">
                                <span className="font-bold text-sm">{groupKey}</span>
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">{items.length} indicadores</Badge>
                                <span className={`text-sm font-bold ml-auto mr-4 ${wrColor}`}>{avgWr.toFixed(1)}% WR</span>
                                {improving > 0 && <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/5 text-[10px]">⭐ {improving}</Badge>}
                                {degrading > 0 && <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/5 text-[10px]">⚠️ {degrading}</Badge>}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-0 pb-0">
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Indicador</TableHead>
                                      <TableHead className="text-right">Win Rate</TableHead>
                                      <TableHead className="text-right">Amostras</TableHead>
                                      <TableHead className="text-right">Peso Original</TableHead>
                                      <TableHead className="text-right">Peso Calibrado</TableHead>
                                      <TableHead className="text-center">Status</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {items.map((w: WeightsRow) => {
                                      const itemWrColor = w.win_rate >= 65 ? 'text-green-500' : w.win_rate < 40 ? 'text-red-500' : 'text-foreground';
                                      const weightChanged = Math.abs(w.calibrated_weight - w.original_weight) > 0.01;
                                      return (
                                        <TableRow key={w.id}>
                                          <TableCell className="font-mono text-xs font-semibold">{w.indicator_name}</TableCell>
                                          <TableCell className={`text-right font-bold ${itemWrColor}`}>{w.win_rate?.toFixed(1)}%</TableCell>
                                          <TableCell className="text-right text-muted-foreground">{w.sample_count}</TableCell>
                                          <TableCell className="text-right font-mono text-muted-foreground">{w.original_weight?.toFixed(2)}</TableCell>
                                          <TableCell className={`text-right font-mono font-bold ${weightChanged ? (w.calibrated_weight > w.original_weight ? 'text-green-500' : 'text-red-500') : 'text-foreground'}`}>
                                            {w.calibrated_weight?.toFixed(2)}
                                            {weightChanged && (
                                              <span className="ml-1 text-[10px]">
                                                {w.calibrated_weight > w.original_weight ? '↑' : '↓'}
                                              </span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-center">
                                            {w.trend === 'IMPROVING' ? (
                                              <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/5 text-[10px]">⭐ Estrela</Badge>
                                            ) : w.trend === 'DEGRADING' ? (
                                              <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/5 text-[10px]">⚠️ Tóxico</Badge>
                                            ) : (
                                              <Badge variant="outline" className="text-muted-foreground border-muted text-[10px]">Estável</Badge>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Backtest com Pesos Calibrados */}
            {refinementLogs && refinementLogs.length > 0 && (
              <Card className="glass-panel border-primary/20 bg-background/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Backtest com Pesos Calibrados
                  </CardTitle>
                  <CardDescription>
                    Simulação retroativa com calibração assimétrica: prioriza minimizar LOSS (🛡️) e depois maximizar WIN.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const latestMap = new Map<string, LogsRow>();
                    refinementLogs.forEach((log: LogsRow) => {
                      const key = `${log.asset}_${log.timeframe}`;
                      if (!latestMap.has(key)) latestMap.set(key, log);
                    });
                    const latestLogs = Array.from(latestMap.values());
                    const hasBacktestData = latestLogs.some((l: LogsRow) => l.projected_wr_new_weights !== null && l.projected_wr_new_weights !== undefined);

                    if (!hasBacktestData) {
                      return (
                        <div className="text-center py-6 text-muted-foreground">
                          <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Dados de backtest ainda não disponíveis.</p>
                          <p className="text-xs mt-1">Execute "Extrair & Calibrar" para gerar a simulação retroativa.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {latestLogs.filter((l: LogsRow) => l.projected_wr_new_weights !== null).map((log: LogsRow) => {
                          const wrReal = log.overall_wr_before ?? 0;
                          const wrProjected = log.projected_wr_new_weights ?? 0;
                          const delta = wrProjected - wrReal;
                          const isImproving = delta > 0;
                          const signalChanges = log.backtest_signal_changes ?? 0;

                          return (
                            <motion.div
                              key={`${log.asset}_${log.timeframe}_${log.id}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`p-4 rounded-xl border ${isImproving ? 'border-green-500/30 bg-green-500/5' : delta < 0 ? 'border-red-500/30 bg-red-500/5' : 'border-muted bg-muted/10'}`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <span className="font-bold text-sm">{log.asset}/{log.timeframe}</span>
                                <Badge variant="outline" className={`text-[10px] ${isImproving ? 'text-green-500 border-green-500/30' : delta < 0 ? 'text-red-500 border-red-500/30' : 'text-muted-foreground border-muted'}`}>
                                  {isImproving ? '📈 Melhorando' : delta < 0 ? '📉 Piorando' : '➡️ Estável'}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">WR Real</div>
                                  <div className="text-xl font-bold text-foreground">{wrReal.toFixed(1)}%</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">WR Projetado</div>
                                  <div className={`text-xl font-bold ${isImproving ? 'text-green-500' : delta < 0 ? 'text-red-500' : 'text-foreground'}`}>
                                    {wrProjected.toFixed(1)}%
                                  </div>
                                </div>
                              </div>

                              {/* New metrics: Loss Avoidance, Missed Opportunity, Threshold */}
                              <div className="grid grid-cols-3 gap-2 mb-3 p-2 rounded-lg bg-muted/10 border border-border/20">
                                <div className="text-center">
                                  <div className="text-[9px] text-muted-foreground uppercase tracking-wide">🛡️ Loss Evitados</div>
                                  <div className={`text-sm font-bold ${(log.loss_avoidance_rate ?? 0) > 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                                    {log.loss_avoidance_rate != null ? `${log.loss_avoidance_rate.toFixed(1)}%` : '—'}
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-[9px] text-muted-foreground uppercase tracking-wide">⚠️ Oport. Perdidas</div>
                                  <div className={`text-sm font-bold ${(log.missed_opportunity_rate ?? 0) > 20 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                                    {log.missed_opportunity_rate != null ? `${log.missed_opportunity_rate.toFixed(1)}%` : '—'}
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-[9px] text-muted-foreground uppercase tracking-wide">🎯 Threshold</div>
                                  <div className="text-sm font-bold text-foreground">
                                    {log.effective_threshold != null ? `${log.effective_threshold}%` : '55%'}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1">
                                  {isImproving ? <ArrowUp className="w-3.5 h-3.5 text-green-500" /> : delta < 0 ? <ArrowDown className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
                                  <span className={`font-bold ${isImproving ? 'text-green-500' : delta < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                    {delta > 0 ? '+' : ''}{delta.toFixed(1)}pp
                                  </span>
                                </div>
                                <button
                                  onClick={() => signalChanges > 0 ? setBacktestDetailLog(log) : null}
                                  className={`${signalChanges > 0 ? 'text-primary hover:underline cursor-pointer' : 'text-muted-foreground cursor-default'} transition-colors`}
                                >
                                  {signalChanges} sinais alterados
                                </button>
                              </div>

                              <div className="mt-3 pt-2 border-t border-border/20 flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>{log.analysis_count} amostras</span>
                                <span>{log.indicators_adjusted} indicadores ajustados</span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Histórico de Calibrações */}
            {refinementLogs && refinementLogs.length > 0 && (
              <Card className="glass-panel border-muted bg-background/50">
                <CardHeader>
                  <CardTitle className="text-sm">Histórico de Calibrações</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {refinementLogs.map((log: LogsRow) => {
                      const hasProjected = log.projected_wr_new_weights !== null && log.projected_wr_new_weights !== undefined;
                      const delta = hasProjected ? (log.projected_wr_new_weights - (log.overall_wr_before ?? 0)) : null;
                      return (
                        <div key={log.id} className="flex items-center justify-between text-xs p-3 rounded-lg bg-muted/20 border border-border/30">
                          <div className="flex items-center gap-3">
                            <span className="font-bold">{log.asset}/{log.timeframe}</span>
                            <span className="text-muted-foreground">{log.analysis_count} amostras</span>
                            <span className="text-muted-foreground">{log.indicators_adjusted} ajustados</span>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap justify-end">
                            <span className="font-mono">WR: {log.overall_wr_before?.toFixed(1)}%</span>
                            {hasProjected && (
                              <span className={`font-mono font-bold ${delta! > 0 ? 'text-green-500' : delta! < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                → {log.projected_wr_new_weights?.toFixed(1)}% ({delta! > 0 ? '+' : ''}{delta!.toFixed(1)}pp)
                              </span>
                            )}
                            {log.loss_avoidance_rate != null && (
                              <span className="text-green-500 text-[10px]">🛡️{log.loss_avoidance_rate.toFixed(0)}% evitados</span>
                            )}
                            {log.backtest_signal_changes > 0 && (
                              <span className="text-primary text-[10px]">{log.backtest_signal_changes} Δ sinais</span>
                            )}
                            <span className="text-muted-foreground text-[10px]">
                              {new Date(log.created_at).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Trash Tab */}
          <TabsContent value="trash" className="space-y-6">
            <Card className="glass-panel border-muted bg-background/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-muted-foreground" />
                  Lixeira
                </CardTitle>
                <CardDescription>
                  Análises excluídas que podem ser restauradas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingDeleted ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : !deletedHistory || deletedHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Trash2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum registro na lixeira.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deletedHistory.map((h) => {
                      const isNeutral = h.signal === 'NEUTRO' || h.signal === 'NEUTRAL';
                      return (
                        <div key={h.id} className="flex items-center justify-between p-3 rounded-lg border border-muted/30 bg-muted/5">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-sm">{h.asset}</span>
                            <Badge variant="secondary" className="text-[10px]">{h.timeframe}</Badge>
                            <StatusBadge status={h.status} />
                            {!isNeutral && h.signal && (
                              <span className={`text-xs font-semibold ${h.signal === 'COMPRA' || h.signal === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>
                                {h.signal}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground">
                              Excluído em {new Date(h.deleted_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => restoreHistoryMutation.mutate(h.id)}
                              disabled={restoreHistoryMutation.isPending}
                            >
                              <RotateCcw className="w-3 h-3 mr-1" /> Restaurar
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog: Detalhamento dos Sinais Alterados */}
        <Dialog open={!!backtestDetailLog} onOpenChange={(open) => !open && setBacktestDetailLog(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-background border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                Sinais Alterados — {backtestDetailLog?.asset}/{backtestDetailLog?.timeframe}
              </DialogTitle>
              <DialogDescription>
                Análises que teriam sinal diferente com os pesos calibrados.
              </DialogDescription>
            </DialogHeader>

            {(() => {
              if (!backtestDetailLog?.backtest_details) {
                return <p className="text-sm text-muted-foreground py-4">Sem dados de backtest detalhados para esta calibração.</p>;
              }

              const details = (backtestDetailLog.backtest_details as unknown) as Array<{
                original_signal: string;
                recalc_signal: string;
                buy_pct: number;
                sell_pct: number;
                actual_result: string;
                would_match: boolean;
              }>;
              const changed = details.filter((d) => d.original_signal !== d.recalc_signal);
              const changedWouldMatch = changed.filter((d) => d.would_match).length;
              const changedWouldFail = changed.length - changedWouldMatch;

              // Also count unchanged for context
              const unchanged = details.filter((d) => d.original_signal === d.recalc_signal);
              const unchangedCorrect = unchanged.filter((d) => d.would_match).length;

              return (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
                      <div className="text-2xl font-bold text-foreground">{changed.length}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Sinais Alterados</div>
                    </div>
                    <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 text-center">
                      <div className="text-2xl font-bold text-green-500">{changedWouldMatch}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Acertariam</div>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
                      <div className="text-2xl font-bold text-red-500">{changedWouldFail}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Errariam</div>
                    </div>
                  </div>

                  {changedWouldMatch > changedWouldFail ? (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-green-500 font-medium text-center">
                      ✅ {changedWouldMatch} de {changed.length} mudanças teriam sido melhores — os pesos calibrados estão aprimorando o sistema.
                    </div>
                  ) : changedWouldMatch < changedWouldFail ? (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-500 font-medium text-center">
                      ⚠️ Apenas {changedWouldMatch} de {changed.length} mudanças teriam sido melhores — calibração precisa de mais dados.
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-muted/20 border border-border/30 text-sm text-muted-foreground font-medium text-center">
                      ➡️ Resultado neutro: {changedWouldMatch} acertos e {changedWouldFail} erros entre as mudanças.
                    </div>
                  )}

                  {/* Table of changed signals */}
                  {changed.length > 0 && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Sinal Original</TableHead>
                            <TableHead className="text-xs">→ Recalculado</TableHead>
                            <TableHead className="text-xs text-right">Buy%</TableHead>
                            <TableHead className="text-xs text-right">Sell%</TableHead>
                            <TableHead className="text-xs">Resultado Real</TableHead>
                            <TableHead className="text-xs text-center">Acertaria?</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {changed.map((d, i) => {
                            const signalColor = (s: string) => s === 'COMPRA' ? 'text-green-500' : s === 'VENDA' ? 'text-red-500' : 'text-muted-foreground';
                            const resultIsWin = d.actual_result?.startsWith('WIN');
                            return (
                              <TableRow key={i}>
                                <TableCell className={`font-bold text-xs ${signalColor(d.original_signal)}`}>
                                  {d.original_signal === 'COMPRA' ? '🟢' : d.original_signal === 'VENDA' ? '🔴' : '⚪'} {d.original_signal}
                                </TableCell>
                                <TableCell className={`font-bold text-xs ${signalColor(d.recalc_signal)}`}>
                                  {d.recalc_signal === 'COMPRA' ? '🟢' : d.recalc_signal === 'VENDA' ? '🔴' : '⚪'} {d.recalc_signal}
                                </TableCell>
                                <TableCell className="text-right text-xs font-mono text-green-500">{d.buy_pct?.toFixed(1)}%</TableCell>
                                <TableCell className="text-right text-xs font-mono text-red-500">{d.sell_pct?.toFixed(1)}%</TableCell>
                                <TableCell className={`text-xs font-bold ${resultIsWin ? 'text-green-500' : 'text-red-500'}`}>
                                  {d.actual_result}
                                </TableCell>
                                <TableCell className="text-center">
                                  {d.would_match ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Context: unchanged signals summary */}
                  <div className="text-[11px] text-muted-foreground pt-2 border-t border-border/20">
                    📊 {unchanged.length} análises mantiveram o mesmo sinal ({unchangedCorrect} corretas) — total de {details.length} analisadas.
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
};

export default AutoTesteAdmin;
