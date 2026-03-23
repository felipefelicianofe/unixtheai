import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, Wifi, Check, Loader2, Trash2, AlertTriangle, TestTube, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { fetchRealAccountInfo } from "@/lib/binanceApi";
import type { ConnectionStatus } from "@/lib/tradingEngine";

interface ApiVaultProps {
  onConnectionChange?: (status: ConnectionStatus | null) => void;
}

export default function ApiVault({ onConnectionChange }: ApiVaultProps) {
  const { user } = useAuth();
  const [broker, setBroker] = useState("binance_futures");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [isTestnet, setIsTestnet] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [hasSaved, setHasSaved] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const realStatus = await fetchRealAccountInfo();
        setStatus(realStatus);
        onConnectionChange?.(realStatus);
        setConnectionError(null);
      } catch {
        // Silent fail on polling
      }
    }, 15000);
  }, [onConnectionChange]);

  const loadCredentials = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("broker_credentials")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBroker(data.broker);
        setApiKey(data.api_key);
        setApiSecret(data.api_secret);
        setIsTestnet(data.is_testnet ?? true);
        setHasSaved(true);

        if (data.is_connected) {
          try {
            const realStatus = await fetchRealAccountInfo();
            setStatus(realStatus);
            onConnectionChange?.(realStatus);
            startPolling();
          } catch (err) {
            console.error("[ApiVault] Auto-reconnect failed:", err);
            setConnectionError(err instanceof Error ? err.message : "Connection failed");
          }
        }
      }
    } catch (err) {
      console.error("[ApiVault] Failed to load credentials:", err);
    } finally {
      setLoading(false);
    }
  }, [user, onConnectionChange, startPolling]);

  useEffect(() => {
    loadCredentials();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadCredentials]);

  const saveCredentials = async (connected: boolean): Promise<boolean> => {
    if (!user) return false;

    const payload = {
      user_id: user.id,
      broker,
      api_key: apiKey.trim(),
      api_secret: apiSecret.trim(),
      is_connected: connected,
      is_testnet: isTestnet,
    };

    const { error } = await supabase
      .from("broker_credentials")
      .upsert(payload as never, { onConflict: "user_id" });

    if (error) {
      console.error("[ApiVault] Save credentials error:", error.message);
      toast.error(`Erro ao salvar credenciais: ${error.message}`);
      return false;
    }

    setHasSaved(true);
    return true;
  };

  const handleConnect = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      toast.error("Preencha API Key e API Secret.");
      return;
    }
    setConnecting(true);
    setConnectionError(null);

    const saved = await saveCredentials(false);
    if (!saved) {
      setConnecting(false);
      return;
    }

    try {
      const realStatus = await fetchRealAccountInfo();
      await saveCredentials(true);
      setStatus(realStatus);
      onConnectionChange?.(realStatus);
      startPolling();
      toast.success(`Conectado à Binance Futures ${isTestnet ? "(Testnet)" : "(Mainnet)"}! Dados reais carregados.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha na conexão";
      setConnectionError(msg);
      toast.error(`Falha na conexão: ${msg}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStatus(null);
    setConnectionError(null);
    onConnectionChange?.(null);
    await saveCredentials(false);
    toast.info("Desconectado. Credenciais mantidas.");
  };

  const handleDeleteCredentials = async () => {
    if (!user) return;
    if (pollRef.current) clearInterval(pollRef.current);
    const { error } = await supabase.from("broker_credentials").delete().eq("user_id", user.id);
    if (error) {
      toast.error(`Erro ao remover credenciais: ${error.message}`);
      return;
    }
    setStatus(null);
    setApiKey("");
    setApiSecret("");
    setHasSaved(false);
    setConnectionError(null);
    setIsTestnet(true);
    onConnectionChange?.(null);
    toast.success("Credenciais removidas.");
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
      transition={{ duration: 0.5 }}
      className="glass rounded-2xl p-6 relative overflow-hidden"
    >
      <AnimatePresence>
        {status?.connected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ boxShadow: "inset 0 0 40px hsl(142 76% 50% / 0.08)" }}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Lock className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-foreground font-semibold text-lg">Conexão com Corretora</h3>
          <p className="text-muted-foreground text-xs">Dados reais da Binance Futures</p>
        </div>
        {hasSaved && !status?.connected && (
          <Button variant="ghost" size="icon" onClick={handleDeleteCredentials} className="text-destructive hover:bg-destructive/10 h-8 w-8">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {connectionError && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="text-xs text-destructive whitespace-pre-line">{connectionError}</p>
            {connectionError.includes("Binance [-2015]") && (
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                <li>Na Binance, ative a permissão <strong>Futures</strong> na API Key.</li>
                <li>Confira se a chave é do mesmo ambiente selecionado (Testnet/Mainnet).</li>
                <li>Se usar cloud com IP dinâmico, não restrinja a chave por IP fixo.</li>
              </ul>
            )}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!status?.connected ? (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Corretora</label>
              <Select value={broker} onValueChange={setBroker}>
                <SelectTrigger className="bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="binance_futures">Binance Futures</SelectItem>
                  <SelectItem value="bybit">Bybit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Testnet / Mainnet toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-border/30">
              <div className="flex items-center gap-2">
                {isTestnet ? (
                  <TestTube className="w-4 h-4 text-amber-400" />
                ) : (
                  <Globe className="w-4 h-4 text-[hsl(var(--neon-green))]" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {isTestnet ? "Testnet (Simulação)" : "Mainnet (Dinheiro Real)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isTestnet ? "Sem risco financeiro" : "⚠️ Operações com capital real"}
                  </p>
                </div>
              </div>
              <Switch
                checked={!isTestnet}
                onCheckedChange={(checked) => setIsTestnet(!checked)}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">API Key</label>
              <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Cole sua API Key..." className="bg-background/50 border-border/50 font-mono text-sm" />
            </div>
            <div className="relative">
              <label className="text-xs text-muted-foreground mb-1.5 block">API Secret</label>
              <div className="relative">
                <Input type={showSecret ? "text" : "password"} value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="Cole sua API Secret..." className="bg-background/50 border-border/50 font-mono text-sm pr-10" />
                <button onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {hasSaved && (
              <p className="text-xs text-primary flex items-center gap-1"><Check className="w-3 h-3" /> Credenciais salvas anteriormente</p>
            )}
            <Button onClick={handleConnect} disabled={connecting || !apiKey.trim() || !apiSecret.trim()} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2">
              {connecting ? (<><Loader2 className="w-4 h-4 animate-spin" />Conectando à Binance...</>) : (<><Wifi className="w-4 h-4" />{hasSaved ? "Reconectar" : "Conectar & Validar"}</>)}
            </Button>
          </motion.div>
        ) : (
          <motion.div key="connected" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--neon-green))] opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[hsl(var(--neon-green))]" />
              </span>
              <span className="text-[hsl(var(--neon-green))] text-sm font-medium">
                Conectado {isTestnet ? "(Testnet)" : "(Live)"}
              </span>
              <Check className="w-4 h-4 text-[hsl(var(--neon-green))] ml-auto" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background/40 rounded-xl p-3 border border-border/30">
                <p className="text-xs text-muted-foreground">Saldo Total</p>
                <p className="text-xl font-bold font-mono text-foreground">${status.accountBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-background/40 rounded-xl p-3 border border-border/30">
                <p className="text-xs text-muted-foreground">Disponível</p>
                <p className="text-xl font-bold font-mono text-foreground">${status.availableBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className="bg-background/40 rounded-xl p-3 border border-border/30">
              <p className="text-xs text-muted-foreground">PnL Não Realizado</p>
              <p className={`text-lg font-bold font-mono ${status.totalPnl >= 0 ? "text-[hsl(var(--neon-green))]" : "text-[hsl(var(--neon-red))]"}`}>
                {status.totalPnl >= 0 ? "+" : ""}${status.totalPnl.toFixed(2)}
              </p>
            </div>
            <Button onClick={handleDisconnect} variant="outline" className="w-full border-destructive/30 text-destructive hover:bg-destructive/10">Desconectar</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
