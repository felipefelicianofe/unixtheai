import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Shield, Zap, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import DailyProfitLock from "./DailyProfitLock";

interface RiskManagementProps {
  accountBalance: number;
  currentPnl: number;
  onAutopilotChange?: (active: boolean) => void;
}

export default function RiskManagement({ accountBalance, currentPnl, onAutopilotChange }: RiskManagementProps) {
  const { user } = useAuth();
  const [autopilot, setAutopilot] = useState(false);
  const [riskPct, setRiskPct] = useState(2);
  const [maxLeverage, setMaxLeverage] = useState("10");
  const [loading, setLoading] = useState(true);
  const [hasSaved, setHasSaved] = useState(false);

  const maxLoss = accountBalance * (riskPct / 100);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("autopilot_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setAutopilot(data.is_active);
        setRiskPct(Number(data.risk_pct));
        setMaxLeverage(String(data.max_leverage));
        setHasSaved(true);
        onAutopilotChange?.(data.is_active);
      }
    } catch (err) {
      console.error("Failed to load autopilot settings:", err);
    } finally {
      setLoading(false);
    }
  }, [user, onAutopilotChange]);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = useCallback(async (updates: {
    is_active?: boolean;
    risk_pct?: number;
    max_leverage?: number;
    deactivation_reason?: string | null;
  }) => {
    if (!user) return;

    const payload = {
      user_id: user.id,
      is_active: updates.is_active ?? autopilot,
      risk_pct: updates.risk_pct ?? riskPct,
      max_leverage: updates.max_leverage ?? Number(maxLeverage),
      deactivation_reason: updates.deactivation_reason ?? null,
    };

    if (hasSaved) {
      await supabase
        .from("autopilot_settings")
        .update(payload)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("autopilot_settings")
        .insert(payload);
      setHasSaved(true);
    }
  }, [user, autopilot, riskPct, maxLeverage, hasSaved]);

  const handleAutopilotToggle = async (checked: boolean) => {
    setAutopilot(checked);
    onAutopilotChange?.(checked);
    await saveSettings({
      is_active: checked,
      deactivation_reason: checked ? null : "user_disabled",
    });
    toast.success(checked ? "Piloto Automático ATIVADO" : "Piloto Automático DESATIVADO");
  };

  const handleRiskChange = async (v: number[]) => {
    setRiskPct(v[0]);
    await saveSettings({ risk_pct: v[0] });
  };

  const handleLeverageChange = async (val: string) => {
    setMaxLeverage(val);
    await saveSettings({ max_leverage: Number(val) });
  };

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="glass rounded-2xl p-6 relative overflow-hidden"
    >
      {/* AI Active glow */}
      {autopilot && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ boxShadow: "inset 0 0 60px hsl(var(--neon-blue) / 0.12), 0 0 30px hsl(var(--neon-blue) / 0.06)" }}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h3 className="text-foreground font-semibold text-lg">Gestão de Risco Institucional</h3>
          <p className="text-muted-foreground text-xs">Controle absoluto de exposição</p>
        </div>
      </div>

      {/* Autopilot Toggle */}
      <motion.div
        className={`rounded-xl p-4 mb-6 border transition-colors duration-500 ${
          autopilot
            ? "bg-primary/10 border-primary/30"
            : "bg-background/40 border-border/30"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={autopilot ? { scale: [1, 1.15, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Zap className={`w-5 h-5 ${autopilot ? "text-primary" : "text-muted-foreground"}`} />
            </motion.div>
            <div>
              <p className="text-sm font-semibold text-foreground">Ativar Piloto Automático IA</p>
              <p className="text-xs text-muted-foreground">
                {autopilot ? "IA operando autonomamente — persiste entre sessões" : "Ative para execução autônoma"}
              </p>
            </div>
          </div>
          <Switch
            checked={autopilot}
            onCheckedChange={handleAutopilotToggle}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </motion.div>

      {/* Risk Slider */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm text-muted-foreground">Risco por Operação (% da Banca)</label>
            <span className={`text-sm font-bold font-mono ${
              riskPct <= 2 ? "text-[hsl(var(--neon-green))]" :
              riskPct <= 5 ? "text-yellow-400" :
              "text-[hsl(var(--neon-red))]"
            }`}>
              {riskPct}%
            </span>
          </div>
          <Slider
            value={[riskPct]}
            onValueChange={(v) => setRiskPct(v[0])}
            onValueCommit={handleRiskChange}
            min={1}
            max={10}
            step={0.5}
            className="w-full"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-[hsl(var(--neon-green))]">Conservador</span>
            <span className="text-[10px] text-yellow-400">Moderado</span>
            <span className="text-[10px] text-[hsl(var(--neon-red))]">Agressivo</span>
          </div>
        </div>

        {/* Dynamic Calculator */}
        <motion.div
          key={riskPct}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          className="bg-background/40 rounded-xl p-3 border border-border/30"
        >
          <p className="text-xs text-muted-foreground">
            Em caso de Stop Loss, sua perda máxima será de{" "}
            <span className="text-[hsl(var(--neon-red))] font-bold font-mono">
              ${maxLoss.toFixed(2)}
            </span>
          </p>
        </motion.div>

        {/* Max Leverage */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Alavancagem Máxima</label>
          <Select value={maxLeverage} onValueChange={handleLeverageChange}>
            <SelectTrigger className="bg-background/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3x (Conservador)</SelectItem>
              <SelectItem value="5">5x (Moderado)</SelectItem>
              <SelectItem value="10">10x (Agressivo)</SelectItem>
              <SelectItem value="20">20x (Alto Risco)</SelectItem>
              <SelectItem value="50">50x (Extremo)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status indicators */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <div className="text-center p-2 rounded-lg bg-background/30 border border-border/20">
            <p className="text-[10px] text-muted-foreground">Max Loss</p>
            <p className="text-xs font-mono font-bold text-[hsl(var(--neon-red))]">
              ${maxLoss.toFixed(2)}
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-background/30 border border-border/20">
            <p className="text-[10px] text-muted-foreground">Leverage</p>
            <p className="text-xs font-mono font-bold text-foreground">{maxLeverage}x</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-background/30 border border-border/20">
            <p className="text-[10px] text-muted-foreground">Status</p>
            <p className={`text-xs font-bold ${autopilot ? "text-primary" : "text-muted-foreground"}`}>
              {autopilot ? "ATIVO" : "OFF"}
            </p>
          </div>
        </div>

        {/* Daily Profit Lock (Kill Switch) */}
        <DailyProfitLock currentPnl={currentPnl} />
      </div>
    </motion.div>
  );
}
