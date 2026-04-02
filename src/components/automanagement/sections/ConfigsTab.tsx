import React, { useState } from "react";
import { Plus, Database, Play, Target, Trash2, Loader2, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ConfigRow } from "@/hooks/useAutoManagement";

const AVAILABLE_ASSETS = [
  "BTCUSDT", "PAXGUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT", "DOTUSDT", "AVAXUSDT", 
  "DOGEUSDT", "XRPUSDT", "LINKUSDT", "MATICUSDT", "BNBUSDT", "ATOMUSDT", 
  "NEARUSDT", "ARBUSDT", "OPUSDT", "SUIUSDT", "APTUSDT", "UNIUSDT", 
  "AAVEUSDT", "LTCUSDT"
];

const TIMEFRAMES = ["15m", "30m", "1h", "4h", "1d"];

interface ConfigsTabProps {
  configs: ConfigRow[] | undefined;
  loadingConfigs: boolean;
  isCreating: boolean;
  setIsCreating: (v: boolean) => void;
  createConfigMutation: any;
  toggleConfigMutation: any;
  deleteConfigMutation: any;
}

export const ConfigsTab: React.FC<ConfigsTabProps> = ({
  configs,
  loadingConfigs,
  isCreating,
  setIsCreating,
  createConfigMutation,
  toggleConfigMutation,
  deleteConfigMutation,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [newAsset, setNewAsset] = useState("");
  const [newTimeframe, setNewTimeframe] = useState("");
  const [newPeriod, setNewPeriod] = useState("45");
  const [newLeverage, setNewLeverage] = useState("1");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset || !newTimeframe || !newPeriod) {
      toast.error("Preencha todos os campos.");
      return;
    }
    createConfigMutation.mutate({
      asset: newAsset,
      timeframe: newTimeframe,
      period: parseInt(newPeriod),
      leverage: parseInt(newLeverage),
    }, {
      onSuccess: () => {
        setIsCreating(false);
        setNewAsset("");
        setNewTimeframe("");
      }
    });
  };

  const activeCount = configs?.filter(c => c.is_active).length || 0;
  const totalCount = configs?.length || 0;

  return (
    <div className="space-y-6">
      {/* Collapsible header */}
      <Card className="glass-panel border-muted bg-background/50 overflow-hidden">
        <div
          className="flex items-center justify-between px-6 py-4 cursor-pointer select-none"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Configurações Ativas</h2>
            {!expanded && !loadingConfigs && totalCount > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[10px]">{activeCount} ativas</Badge>
                <span>de {totalCount} configs</span>
                <span className="text-muted-foreground/60">•</span>
                <span className="flex gap-1 flex-wrap">
                  {configs?.filter(c => c.is_active).slice(0, 5).map(c => (
                    <Badge key={c.id} variant="outline" className="text-[9px] px-1.5 py-0">
                      {c.asset} {c.timeframe}
                    </Badge>
                  ))}
                  {activeCount > 5 && (
                    <span className="text-[10px] text-muted-foreground">+{activeCount - 5}</span>
                  )}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={(e) => { e.stopPropagation(); setIsCreating(!isCreating); setExpanded(true); }}
              variant="outline"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" /> Nova
            </Button>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-6 space-y-6">
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
                    <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <p>Carregando configurações...</p>
                    </div>
                  ) : !configs || configs.length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                      <Database className="w-12 h-12 opacity-20" />
                      <p>Nenhuma configuração ativa de monitoramento.</p>
                    </div>
                  ) : (
                    configs.map((config) => (
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
};
