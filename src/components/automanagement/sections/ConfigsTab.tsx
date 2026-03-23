import React, { useState } from "react";
import { Plus, Database, Play, Target, Trash2, Loader2, Zap } from "lucide-react";
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
  createAllConfigsMutation: any;
  toggleConfigMutation: any;
  deleteConfigMutation: any;
}

export const ConfigsTab: React.FC<ConfigsTabProps> = ({
  configs,
  loadingConfigs,
  isCreating,
  setIsCreating,
  createConfigMutation,
  createAllConfigsMutation,
  toggleConfigMutation,
  deleteConfigMutation,
}) => {
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Configurações Ativas</h2>
        <Button onClick={() => setIsCreating(!isCreating)} variant="outline">
          <Plus className="w-4 h-4 mr-2" /> Nova Ação
        </Button>
      </div>

      {isCreating && (
        <Card className="glass-panel border-primary/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-primary/5 pointer-events-none" />
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div>
              <CardTitle className="text-lg">Nova Ação de AutoAnálise</CardTitle>
              <CardDescription>Defina o ativo individualmente, ou preencha a base de dados rapidamente.</CardDescription>
            </div>
            <Button 
              type="button" 
              variant="default" 
              className="bg-amber-500 hover:bg-amber-600 text-white border-none shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all ease-in-out duration-300 transform hover:scale-[1.02]"
              onClick={() => createAllConfigsMutation.mutate()}
              disabled={createAllConfigsMutation.isPending}
            >
              {createAllConfigsMutation.isPending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Zap className="w-5 h-5 mr-2 text-yellow-100 fill-yellow-200" />
              )}
              Fast Setup: Adicionar Tudo (15m, 1m, 150x)
            </Button>
          </CardHeader>
          <CardContent className="relative z-10">
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
  );
};
