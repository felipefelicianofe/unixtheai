import React, { useState } from "react";
import { motion } from "framer-motion";
import { Target, Trash2, XCircle } from "lucide-react";
import AppNavBar from "@/components/AppNavBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAutoManagement, RefinementLog } from "@/hooks/useAutoManagement";

// UI Components
import MonitoringDashboard from "@/components/automanagement/MonitoringDashboard";
import ActiveSignalCard from "@/components/automanagement/ActiveSignalCard";
import DashboardMetrics from "@/components/automanagement/DashboardMetrics";
import { AssetWinRateGrid } from "@/components/automanagement/AssetWinRateGrid";

// Section Components
import { ConfigsTab } from "@/components/automanagement/sections/ConfigsTab";
import { HistoryTab } from "@/components/automanagement/sections/HistoryTab";
import { RefinementTab } from "@/components/automanagement/sections/RefinementTab";
import { TrashTab } from "@/components/automanagement/sections/TrashTab";
import { BacktestDetailDialog } from "@/components/automanagement/sections/BacktestDetailDialog";

const AutoGerenciamentoV2 = () => {
  const am = useAutoManagement();
  const [backtestDetailLog, setBacktestDetailLog] = useState<RefinementLog | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <AppNavBar />
      
      <main className="relative z-10 pt-24 pb-24 px-4 max-w-7xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-foreground">Auto Gerenciamento (V2)</h1>
          <p className="text-muted-foreground mt-2">
            Monitoramento 24/7 com sinais de entrada em tempo real e calibração dinâmica.
          </p>
        </motion.div>

        {/* Global Loading State */}
        {(am.loadingConfigs || am.loadingHistory) ? (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="space-y-6"
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
               {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl bg-muted/10 border border-primary/10" />)}
            </div>
            <Skeleton className="h-48 w-full rounded-xl bg-muted/10 border border-primary/10 shadow-lg shadow-primary/5" />
            <Skeleton className="h-64 w-full rounded-xl bg-muted/10 border border-primary/10 shadow-lg shadow-primary/5" />
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-8"
          >
            {/* Dashboard Indicators */}
            <DashboardMetrics
              winRate={am.stats.winRate}
              totalWins={am.stats.totalWins}
              totalLoss={am.stats.totalLoss}
              totalFinalized={am.stats.totalFinalized}
              totalPending={am.stats.totalPending}
              totalNeutral={am.stats.totalNeutral}
              totalUL={am.stats.totalUL}
              tp1Wins={am.stats.tp1Wins}
              tp2Wins={am.stats.tp2Wins}
              tp3Wins={am.stats.tp3Wins}
            />

            {/* 24/7 Monitoring Dashboard */}
            <MonitoringDashboard
              monitoredAssets={am.monitoredAssets}
              engineRunning={am.engineRunning}
              totalRequests={am.totalRequests}
              totalSuccess={am.totalSuccess}
            />

            {/* Active Signals Section */}
            {am.activeSignals.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary animate-pulse" />
                  Sinais Ativos ({am.activeSignals.length})
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[...am.activeSignals]
                    .sort((a, b) => {
                      const dateA = new Date(a.activeSignal?.signalTime || 0).getTime();
                      const dateB = new Date(b.activeSignal?.signalTime || 0).getTime();
                      return dateB - dateA;
                    })
                    .map((signal) => (
                      <ActiveSignalCard
                        key={signal.asset}
                        state={signal}
                        onManualClose={am.manualClose}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Win Rate per Asset */}
            <AssetWinRateGrid 
              history={am.history}
              selectedAssets={am.selectedAssets}
              toggleAssetFilter={am.toggleAssetFilter}
              setSelectedAssets={am.setSelectedAssets}
            />
          </motion.div>
        )}

        <Tabs defaultValue="configs" className="w-full">
          <TabsList className="mb-6 grid w-full md:w-[600px] grid-cols-4">
            <TabsTrigger value="configs">Configurações</TabsTrigger>
            <TabsTrigger value="history">Histórico & Verificação</TabsTrigger>
            <TabsTrigger value="refinement">🧠 Auto-Refinamento</TabsTrigger>
            <TabsTrigger value="trash">🗑️ Lixeira{am.deletedHistory && am.deletedHistory.length > 0 ? ` (${am.deletedHistory.length})` : ''}</TabsTrigger>
          </TabsList>

          <TabsContent value="configs">
            <ConfigsTab 
              configs={am.configs}
              loadingConfigs={am.loadingConfigs}
              isCreating={am.isCreating}
              setIsCreating={am.setIsCreating}
              createConfigMutation={am.createConfigMutation}
              toggleConfigMutation={am.toggleConfigMutation}
              deleteConfigMutation={am.deleteConfigMutation}
            />
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab 
              displayedHistory={am.displayedHistory}
              loadingHistory={am.loadingHistory}
              selectedAssets={am.selectedAssets}
              showNeutros={am.showNeutros}
              handleToggleNeutros={am.handleToggleNeutros}
              verifyMutation={am.verifyMutation}
              deleteHistoryMutation={am.deleteHistoryMutation}
              expandedRowId={am.expandedRowId}
              setExpandedRowId={am.setExpandedRowId}
              historyLimit={am.historyLimit}
              livePriceMap={am.livePriceMap}
            />
          </TabsContent>

          <TabsContent value="refinement">
            <RefinementTab 
              refinementWeights={am.refinementWeights}
              refinementLogs={am.refinementLogs}
              refineMutation={am.refineMutation}
              setBacktestDetailLog={setBacktestDetailLog}
            />
          </TabsContent>

          <TabsContent value="trash">
            <TrashTab 
              deletedHistory={am.deletedHistory}
              loadingDeleted={am.loadingDeleted}
              restoreHistoryMutation={am.restoreHistoryMutation}
            />
          </TabsContent>
        </Tabs>

        {/* Dialog Details */}
        <BacktestDetailDialog 
          log={backtestDetailLog}
          onClose={() => setBacktestDetailLog(null)}
        />

      </main>
    </div>
  );
};

export default AutoGerenciamentoV2;
