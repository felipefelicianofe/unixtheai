import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Send, Shield, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { calculatePositionSize } from "@/lib/tradingEngine";
import type { AISignal } from "@/hooks/useLiveTradeEngine";

interface Props {
  selectedAsset: string;
  currentPrice: number;
  aiSignal: AISignal;
  isConnected: boolean;
  accountBalance: number;
  onOrderPlaced: () => void;
}

export default function OrderPanel({
  selectedAsset,
  currentPrice,
  aiSignal,
  isConnected,
  accountBalance,
  onOrderPlaced,
}: Props) {
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT" | "STOP_MARKET">("MARKET");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [leverage, setLeverage] = useState("10");
  const [submitting, setSubmitting] = useState(false);

  const riskCalc = useMemo(() => {
    const sl = parseFloat(stopLoss);
    const entry = orderType === "LIMIT" ? parseFloat(limitPrice) : currentPrice;
    if (!sl || !entry || !accountBalance) return null;
    return calculatePositionSize(accountBalance, 1, entry, sl, parseInt(leverage) || 10);
  }, [stopLoss, limitPrice, currentPrice, accountBalance, leverage, orderType]);

  const handleSubmit = async () => {
    if (!isConnected) {
      toast.error("Conecte sua corretora primeiro");
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      toast.error("Informe a quantidade");
      return;
    }

    setSubmitting(true);
    try {
      const cleanSymbol = selectedAsset.replace("/", "").toUpperCase();
      const body: Record<string, unknown> = {
        action: "place_order",
        symbol: cleanSymbol,
        side,
        type: orderType,
        quantity: parseFloat(quantity),
      };

      if (orderType === "LIMIT" && limitPrice) {
        body.price = parseFloat(limitPrice);
        body.timeInForce = "GTC";
      }
      if (orderType === "STOP_MARKET" && limitPrice) {
        body.stopPrice = parseFloat(limitPrice);
      }

      await supabase.functions.invoke("binance-proxy", { body });
      toast.success(`Ordem ${side} ${orderType} enviada para ${cleanSymbol}`);

      // Place SL/TP if set
      const inverseSide = side === "BUY" ? "SELL" : "BUY";
      if (stopLoss) {
        await supabase.functions.invoke("binance-proxy", {
          body: {
            action: "place_order",
            symbol: cleanSymbol,
            side: inverseSide,
            type: "STOP_MARKET",
            quantity: parseFloat(quantity),
            stopPrice: parseFloat(stopLoss),
            reduceOnly: true,
          },
        });
      }
      if (takeProfit) {
        await supabase.functions.invoke("binance-proxy", {
          body: {
            action: "place_order",
            symbol: cleanSymbol,
            side: inverseSide,
            type: "TAKE_PROFIT_MARKET",
            quantity: parseFloat(quantity),
            stopPrice: parseFloat(takeProfit),
            reduceOnly: true,
          },
        });
      }

      onOrderPlaced();
      setQuantity("");
      setLimitPrice("");
      setStopLoss("");
      setTakeProfit("");
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : "Falha ao enviar ordem"}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-card rounded-2xl p-5 border border-border/20 flex flex-col"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
          <Send className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Painel de Ordens</h3>
          <p className="text-[10px] text-muted-foreground">
            {selectedAsset} • ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* AI Suggestion Badge */}
      {aiSignal.confidence > 0 && !aiSignal.loading && (
        <div
          className={`mb-4 p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            aiSignal.direction === "LONG"
              ? "bg-[hsl(var(--neon-green))]/5 border-[hsl(var(--neon-green))]/20 text-[hsl(var(--neon-green))]"
              : aiSignal.direction === "SHORT"
              ? "bg-[hsl(var(--neon-red))]/5 border-[hsl(var(--neon-red))]/20 text-[hsl(var(--neon-red))]"
              : "bg-muted/30 border-border/30 text-muted-foreground"
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>
            IA sugere <strong>{aiSignal.direction}</strong> com{" "}
            <strong>{aiSignal.confidence.toFixed(0)}%</strong> de confiança
          </span>
        </div>
      )}

      {/* Side Buttons */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Button
          variant={side === "BUY" ? "default" : "outline"}
          onClick={() => setSide("BUY")}
          className={
            side === "BUY"
              ? "bg-[hsl(var(--neon-green))] hover:bg-[hsl(var(--neon-green))]/80 text-background font-bold"
              : "border-[hsl(var(--neon-green))]/30 text-[hsl(var(--neon-green))] hover:bg-[hsl(var(--neon-green))]/10"
          }
        >
          <TrendingUp className="w-4 h-4 mr-1" /> LONG
        </Button>
        <Button
          variant={side === "SELL" ? "default" : "outline"}
          onClick={() => setSide("SELL")}
          className={
            side === "SELL"
              ? "bg-[hsl(var(--neon-red))] hover:bg-[hsl(var(--neon-red))]/80 text-background font-bold"
              : "border-[hsl(var(--neon-red))]/30 text-[hsl(var(--neon-red))] hover:bg-[hsl(var(--neon-red))]/10"
          }
        >
          <TrendingDown className="w-4 h-4 mr-1" /> SHORT
        </Button>
      </div>

      {/* Order Type Tabs */}
      <Tabs value={orderType} onValueChange={(v) => setOrderType(v as typeof orderType)} className="mb-4">
        <TabsList className="w-full bg-muted/30">
          <TabsTrigger value="MARKET" className="flex-1 text-xs">Market</TabsTrigger>
          <TabsTrigger value="LIMIT" className="flex-1 text-xs">Limit</TabsTrigger>
          <TabsTrigger value="STOP_MARKET" className="flex-1 text-xs">Stop</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Form Fields */}
      <div className="space-y-3 flex-1">
        {orderType !== "MARKET" && (
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
              {orderType === "LIMIT" ? "Preço Limite" : "Preço Stop"}
            </label>
            <Input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder={`$${currentPrice.toFixed(2)}`}
              className="bg-muted/20 border-border/50 font-mono text-sm"
            />
          </div>
        )}

        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Quantidade</label>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.001"
            className="bg-muted/20 border-border/50 font-mono text-sm"
          />
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Alavancagem</label>
          <Input
            type="number"
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
            placeholder="10"
            className="bg-muted/20 border-border/50 font-mono text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Stop Loss</label>
            <Input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="SL"
              className="bg-muted/20 border-border/50 font-mono text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Take Profit</label>
            <Input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="TP"
              className="bg-muted/20 border-border/50 font-mono text-sm"
            />
          </div>
        </div>

        {/* Risk calculation */}
        {riskCalc && (
          <div className="p-2.5 rounded-lg bg-muted/20 border border-border/20 text-[10px] text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Risco</span>
              <span className="font-mono text-foreground">${riskCalc.riskAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Valor Nocional</span>
              <span className="font-mono text-foreground">${riskCalc.notionalValue.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={submitting || !isConnected}
        className={`w-full mt-4 font-bold text-sm h-11 ${
          side === "BUY"
            ? "bg-[hsl(var(--neon-green))] hover:bg-[hsl(var(--neon-green))]/80 text-background"
            : "bg-[hsl(var(--neon-red))] hover:bg-[hsl(var(--neon-red))]/80 text-background"
        }`}
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            {side === "BUY" ? "Comprar" : "Vender"} {selectedAsset.split("/")[0] || selectedAsset}
          </>
        )}
      </Button>
    </motion.div>
  );
}
