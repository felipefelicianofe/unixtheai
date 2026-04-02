import { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useMonitoringEngine } from "@/hooks/useMonitoringEngine";
import type { Database as SupabaseDatabase } from "@/integrations/supabase/types";

export type ConfigRow = SupabaseDatabase['public']['Tables']['auto_management_configs']['Row'];
export type HistoryRow = SupabaseDatabase['public']['Tables']['auto_management_history']['Row'] & {
  auto_management_configs?: {
    asset: string;
    timeframe: string;
    analysis_period_minutes: number;
    leverage: number;
  } | null;
};

export type RefinementLog = SupabaseDatabase['public']['Tables']['management_refinement_log']['Row'] & {
  backtest_details?: Array<{
    original_signal: string;
    recalc_signal: string;
    buy_pct: number;
    sell_pct: number;
    actual_result: string;
    would_match: boolean;
  }>;
};

export type RefinementWeight = SupabaseDatabase['public']['Tables']['management_refinement_weights']['Row'];

export function useAutoManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // -- UI State --
  const [isCreating, setIsCreating] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [historyLimit, setHistoryLimit] = useState(50);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [showNeutros, setShowNeutros] = useState<boolean>(() => {
    const stored = localStorage.getItem('automanagement-show-neutros');
    return stored !== null ? stored === 'true' : true;
  });

  const handleToggleNeutros = (value: boolean) => {
    setShowNeutros(value);
    localStorage.setItem('automanagement-show-neutros', String(value));
  };

  // -- Data Fetching --
  const { data: configs, isLoading: loadingConfigs } = useQuery({
    queryKey: ['auto-management-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_management_configs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ConfigRow[];
    }
  });

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['auto-management-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_management_history')
        .select(`*, auto_management_configs (asset, timeframe, analysis_period_minutes, leverage)`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10000);
      if (error) throw error;
      return (data as unknown) as HistoryRow[];
    },
    refetchInterval: 30000,
  });

  const { data: deletedHistory, isLoading: loadingDeleted } = useQuery({
    queryKey: ['deleted-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_management_history')
        .select(`id, asset, timeframe, signal, status, created_at, deleted_at`)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as unknown) as HistoryRow[];
    },
  });

  const { data: refinementWeights } = useQuery({
    queryKey: ['refinement-weights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('management_refinement_weights')
        .select('*')
        .order('win_rate', { ascending: false });
      if (error) throw error;
      return (data as unknown) as RefinementWeight[];
    }
  });

  const { data: refinementLogs } = useQuery({
    queryKey: ['refinement-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('management_refinement_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as unknown) as RefinementLog[];
    }
  });

  // -- Monitoring Engine --
  const {
    monitoredAssets,
    activeSignals,
    engineRunning,
    totalRequests,
    totalSuccess,
    manualClose,
    refreshConfigs,
  } = useMonitoringEngine(true);

  const livePriceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const state of monitoredAssets) {
      if (state.currentPrice !== null) {
        map.set(state.asset, state.currentPrice);
      }
    }
    return map;
  }, [monitoredAssets]);

  // -- Mutations --
  const verifyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('verify-management-results');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-management-history'] });
      toast.success("Reverificação concluída!");
    },
    onError: (err: any) => toast.error("Erro na verificação: " + err.message),
  });

  const refineMutation = useMutation({
    mutationFn: async (mode: string) => {
      const { data, error } = await supabase.functions.invoke('management-auto-refine', { body: { mode } });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['refinement-weights'] });
      queryClient.invalidateQueries({ queryKey: ['refinement-logs'] });
      toast.success(`Auto-Refinamento concluído! Extraídos: ${data?.extracted || 0}, Calibrados: ${data?.calibrated || 0}`);
    },
    onError: (err: any) => toast.error("Erro no refinamento: " + err.message),
  });

  const createConfigMutation = useMutation({
    mutationFn: async ({ asset, timeframe, period, leverage }: { asset: string, timeframe: string, period: number, leverage: number }) => {
      if (!user) throw new Error("Usuário não logado");
      const { error } = await supabase.from('auto_management_configs').insert({
        asset: asset.toUpperCase(),
        timeframe,
        analysis_period_minutes: period,
        leverage: leverage || 1,
        admin_id: user.id,
        is_active: true,
        last_run_at: null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['auto-management-configs'] });
      toast.success("Ação criada! Monitoramento 24/7 iniciado.");
      refreshConfigs();
      try {
        await supabase.functions.invoke('run-auto-management');
        queryClient.invalidateQueries({ queryKey: ['auto-management-history'] });
      } catch (e) {
        console.error("Erro ao engatilhar run-auto-management", e);
      }
    },
    onError: (err: any) => toast.error("Erro ao criar: " + err.message),
  });

  const toggleConfigMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string, is_active: boolean }) => {
      const { error } = await supabase
        .from('auto_management_configs')
        .update({ is_active, ...(is_active ? { last_run_at: null } : {}) })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['auto-management-configs'] });
      toast.success(`Configuração ${variables.is_active ? 'ativada' : 'desativada'}.`);
      refreshConfigs();
      if (variables.is_active) {
        try {
          await supabase.functions.invoke('run-auto-management');
          queryClient.invalidateQueries({ queryKey: ['auto-management-history'] });
        } catch (e) { console.error(e); }
      }
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('auto_management_configs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-management-configs'] });
      toast.success("Configuração excluída!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteHistoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('auto_management_history').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-management-history'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-history'] });
      toast.success("Análise movida para lixeira!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const restoreHistoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('auto_management_history').update({ deleted_at: null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-management-history'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-history'] });
      toast.success("Análise restaurada!");
    },
    onError: (err: any) => toast.error("Erro ao restaurar: " + err.message),
  });

  // ── RESET mutations ──
  const clearAllHistoryMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('auto_management_history')
        .update({ deleted_at: new Date().toISOString() })
        .is('deleted_at', null)
        .select('id');
      if (error) throw error;
      return data?.length || 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['auto-management-history'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-history'] });
      toast.success(`${count} registro(s) movido(s) para a lixeira.`);
    },
    onError: (err: any) => toast.error("Erro ao limpar histórico: " + err.message),
  });

  const closeAllSignalsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('auto_management_history')
        .update({ status: 'NEUTRAL', close_reason: 'MANUAL_RESET', closed_at: new Date().toISOString() })
        .in('status', ['PENDING', 'WIN_TP1', 'WIN_TP2'])
        .is('deleted_at', null)
        .select('id');
      if (error) throw error;
      return data?.length || 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['auto-management-history'] });
      toast.success(`${count} sinal(is) ativo(s) fechado(s).`);
    },
    onError: (err: any) => toast.error("Erro ao fechar sinais: " + err.message),
  });

  // -- Processed Data --
  const toggleAssetFilter = useCallback((asset: string) => {
    setSelectedAssets(prev => {
      const next = new Set(prev);
      if (next.has(asset)) next.delete(asset);
      else next.add(asset);
      return next;
    });
  }, []);

  const filteredHistory = useMemo(() => {
    if (selectedAssets.size === 0) return history || [];
    return history?.filter((h) => selectedAssets.has(h.asset)) || [];
  }, [history, selectedAssets]);

  const dedupedHistory = useMemo(() => {
    const seenActiveAssets = new Set<string>();
    return filteredHistory.filter((h) => {
      const isActive = ['PENDING', 'WIN_TP1', 'WIN_TP2'].includes(h.status);
      const isNeutral = h.status === 'NEUTRAL' || h.signal === 'NEUTRO' || h.signal === 'NEUTRAL';
      
      if (isActive && !isNeutral) {
        if (seenActiveAssets.has(h.asset)) return false;
        seenActiveAssets.add(h.asset);
      }
      return true;
    });
  }, [filteredHistory]);

  const displayedHistory = useMemo(() => {
    if (showNeutros) return dedupedHistory;
    return dedupedHistory.filter((h) => !(h.status === 'NEUTRAL' || ((h.signal === 'NEUTRO' || h.signal === 'NEUTRAL') && h.status === 'PENDING')));
  }, [dedupedHistory, showNeutros]);

  const actionableHistory = useMemo(() => {
    return filteredHistory.filter((h) => {
      const isNeutral = h.status === "NEUTRAL" || h.signal === "NEUTRO" || h.signal === "NEUTRAL";
      return !isNeutral;
    });
  }, [filteredHistory]);

  const stats = useMemo(() => {
    const totalNeutral = filteredHistory.length - actionableHistory.length;
    const totalPending = actionableHistory.filter((h) => h.status === 'PENDING').length;
    const totalFinalized = actionableHistory.filter((h) => h.status?.startsWith('WIN') || h.status === 'LOSS').length;
    const totalWins = actionableHistory.filter((h) => h.status?.startsWith('WIN')).length;
    const totalLoss = actionableHistory.filter((h) => h.status === 'LOSS').length;
    const winRate = totalWins + totalLoss > 0 ? (totalWins / (totalWins + totalLoss)) * 100 : 0;

    const totalUL = actionableHistory.reduce((sum: number, h) => {
      if (h.status === 'WIN_TP1') return sum + 1;
      if (h.status === 'WIN_TP2') return sum + 2;
      if (h.status === 'WIN_TP3' || h.status === 'WIN') return sum + 3;
      if (h.status === 'LOSS') return sum - 1;
      return sum;
    }, 0);

    return {
      totalNeutral,
      totalPending,
      totalFinalized,
      totalWins,
      totalLoss,
      winRate,
      totalUL,
      tp1Wins: actionableHistory.filter((h) => h.status === 'WIN_TP1').length,
      tp2Wins: actionableHistory.filter((h) => h.status === 'WIN_TP2').length,
      tp3Wins: actionableHistory.filter((h) => h.status === 'WIN_TP3' || h.status === 'WIN').length,
    };
  }, [filteredHistory, actionableHistory]);

  return {
    user,
    // UI State
    isCreating, setIsCreating,
    expandedRowId, setExpandedRowId,
    historyLimit, setHistoryLimit,
    selectedAssets, setSelectedAssets, toggleAssetFilter,
    showNeutros, handleToggleNeutros,
    // Data
    configs, loadingConfigs,
    history, loadingHistory,
    deletedHistory, loadingDeleted,
    refinementWeights,
    refinementLogs,
    // Monitoring
    monitoredAssets,
    activeSignals,
    engineRunning,
    totalRequests,
    totalSuccess,
    livePriceMap,
    manualClose,
    // Mutations
    verifyMutation,
    refineMutation,
    createConfigMutation,
    toggleConfigMutation,
    deleteConfigMutation,
    deleteHistoryMutation,
    restoreHistoryMutation,
    clearAllHistoryMutation,
    closeAllSignalsMutation,
    // Processed
    filteredHistory,
    dedupedHistory,
    displayedHistory,
    actionableHistory,
    stats,
  };
}
