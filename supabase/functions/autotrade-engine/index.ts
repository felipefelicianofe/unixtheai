import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { assets, timeframe } = await req.json();

    // 1. Get user's autopilot settings
    const { data: settings } = await supabase
      .from("autopilot_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!settings?.is_active) {
      return new Response(
        JSON.stringify({ executed: false, reason: "Autopilot is not active" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get broker credentials
    const { data: creds } = await supabase
      .from("broker_credentials")
      .select("api_key, api_secret, broker, is_connected")
      .eq("user_id", user.id)
      .single();

    if (!creds?.is_connected) {
      return new Response(
        JSON.stringify({ executed: false, reason: "Broker not connected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Run analysis on each asset via the analyze-asset function internally
    const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-asset`;
    
    interface AutotradeResult {
      asset: string;
      signal?: string;
      confidence?: number;
      executed: boolean;
      reason?: string;
      side?: string;
      quantity?: number;
      leverage?: number;
      stopLoss?: number;
      takeProfit?: number;
      orderId?: string;
    }

    const results: AutotradeResult[] = [];
    const targetAssets = assets as string[] || ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

    for (const asset of targetAssets) {
      try {
        console.log(`[AUTOTRADE] Analyzing ${asset}/${timeframe || "1h"}...`);

        const analysisRes = await fetch(analyzeUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            apikey: supabaseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ asset, timeframe: timeframe || "1h" }),
        });

        if (!analysisRes.ok) {
          const errText = await analysisRes.text();
          console.error(`[AUTOTRADE] Analysis failed for ${asset}: ${errText}`);
          continue;
        }

        const analysis = await analysisRes.json();

        // 4. Check if signal is strong enough to execute
        const confidence = analysis?.header?.final_confidence_pct || 0;
        const signal = analysis?.header?.signal;
        const signalStrength = analysis?.header?.signal_strength_pct || 0;

        console.log(
          `[AUTOTRADE] ${asset}: Signal=${signal}, Confidence=${confidence}%, Strength=${signalStrength}%`
        );

        // Only execute on high-confidence signals
        if (confidence < 75 || signal === "NEUTRO") {
          results.push({
            asset,
            signal,
            confidence,
            executed: false,
            reason: `Confidence ${confidence}% below 75% threshold or neutral signal`,
          });
          continue;
        }

        // 5. Calculate position size
        const accountRes = await fetch(
          `${supabaseUrl}/functions/v1/binance-proxy`,
          {
            method: "POST",
            headers: {
              Authorization: authHeader,
              apikey: supabaseKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "account_info" }),
          }
        );

        if (!accountRes.ok) {
          const errText = await accountRes.text();
          console.error(`[AUTOTRADE] Account info failed: ${errText}`);
          continue;
        }

        const account = await accountRes.json();
        const balance = account.availableBalance || 0;
        const riskPct = Number(settings.risk_pct) || 2;
        const maxLeverage = settings.max_leverage || 10;

        // Daily PnL check (kill switch)
        const profitGoal = Number(settings.profit_goal) || 200;
        const maxLoss = Number(settings.max_loss) || 100;
        const dailyPnl = account.totalPnl || 0;

        if (dailyPnl >= profitGoal) {
          // Deactivate autopilot
          const adminClient = createClient(supabaseUrl, serviceKey);
          await adminClient
            .from("autopilot_settings")
            .update({
              is_active: false,
              deactivation_reason: `daily_profit_goal_reached: +$${dailyPnl.toFixed(2)}`,
            })
            .eq("user_id", user.id);

          return new Response(
            JSON.stringify({
              executed: false,
              reason: `Daily profit goal reached (+$${dailyPnl.toFixed(2)}). Autopilot deactivated.`,
              autopilot_deactivated: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (dailyPnl <= -maxLoss) {
          const adminClient = createClient(supabaseUrl, serviceKey);
          await adminClient
            .from("autopilot_settings")
            .update({
              is_active: false,
              deactivation_reason: `daily_loss_limit_reached: -$${Math.abs(dailyPnl).toFixed(2)}`,
            })
            .eq("user_id", user.id);

          return new Response(
            JSON.stringify({
              executed: false,
              reason: `Daily loss limit reached (-$${Math.abs(dailyPnl).toFixed(2)}). Autopilot deactivated.`,
              autopilot_deactivated: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Position sizing
        const entryPrice = analysis?.risk_management?.entry_price || 0;
        const stopLoss = analysis?.risk_management?.stop_loss || 0;
        const tp1 = analysis?.risk_management?.take_profit_1 || 0;

        if (!entryPrice || !stopLoss || !tp1) {
          results.push({
            asset,
            signal,
            confidence,
            executed: false,
            reason: "Missing entry/SL/TP from analysis",
          });
          continue;
        }

        const riskAmount = balance * (riskPct / 100);
        const stopDistance =
          Math.abs(entryPrice - stopLoss) / entryPrice;
        if (stopDistance === 0) continue;

        const positionSizeUSD = riskAmount / stopDistance;
        const leverage = Math.min(
          maxLeverage,
          Math.floor(positionSizeUSD / balance)
        );
        const actualLeverage = Math.max(1, Math.min(leverage, maxLeverage));
        const quantity = (riskAmount / stopDistance) / entryPrice;

        // Round quantity to Binance precision (simplified)
        const symbol = asset.includes("/")
          ? asset.replace("/", "")
          : asset;
        let quantityPrecision = 3;
        if (symbol.includes("BTC")) quantityPrecision = 3;
        else if (symbol.includes("ETH")) quantityPrecision = 3;
        else quantityPrecision = 1;

        const roundedQty = parseFloat(
          quantity.toFixed(quantityPrecision)
        );

        if (roundedQty <= 0) {
          results.push({
            asset,
            signal,
            confidence,
            executed: false,
            reason: "Calculated quantity is 0",
          });
          continue;
        }

        const side = signal === "COMPRA" ? "BUY" : "SELL";

        // 6. Execute via binance-proxy
        console.log(
          `[AUTOTRADE] EXECUTING: ${side} ${roundedQty} ${symbol} @ market, SL=$${stopLoss}, TP=$${tp1}, Leverage=${actualLeverage}x`
        );

        const proxyUrl = `${supabaseUrl}/functions/v1/binance-proxy`;

        // Set leverage
        await fetch(proxyUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            apikey: supabaseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "set_leverage",
            symbol,
            leverage: actualLeverage,
          }),
        });

        // Place market entry order
        const entryRes = await fetch(proxyUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            apikey: supabaseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "place_order",
            symbol,
            side,
            type: "MARKET",
            quantity: roundedQty,
          }),
        });
        const entryResult = await entryRes.json();

        if (entryResult.error) {
          results.push({
            asset,
            signal,
            confidence,
            executed: false,
            reason: `Order failed: ${entryResult.error}`,
          });
          continue;
        }

        // Place Stop Loss
        const slSide = side === "BUY" ? "SELL" : "BUY";
        await fetch(proxyUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            apikey: supabaseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "place_order",
            symbol,
            side: slSide,
            type: "STOP_MARKET",
            quantity: roundedQty,
            stopPrice: stopLoss,
            reduceOnly: true,
          }),
        });

        // Place Take Profit
        await fetch(proxyUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            apikey: supabaseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "place_order",
            symbol,
            side: slSide,
            type: "TAKE_PROFIT_MARKET",
            quantity: roundedQty,
            stopPrice: tp1,
            reduceOnly: true,
          }),
        });

        // 7. Save to analysis_history
        const { data: historyRecord } = await supabase.from("analysis_history").insert({
          user_id: user.id,
          asset,
          timeframe: timeframe || "1h",
          signal: analysis.header.signal,
          signal_strength_pct: signalStrength,
          final_confidence_pct: confidence,
          trend: analysis.header.trend,
          entry_price: entryPrice,
          stop_loss: stopLoss,
          take_profit_1: tp1,
          take_profit_2: analysis?.risk_management?.take_profit_2,
          take_profit_3: analysis?.risk_management?.take_profit_3,
          risk_reward_ratio: analysis?.risk_management?.risk_reward_ratio,
          executive_summary: `[AUTOTRADE] ${analysis?.institutional_synthesis?.executive_summary || ""}`,
          data_source: analysis?._data_source,
          full_result: analysis,
        }).select().single();

        // 8. Create trade_positions record (state machine)
        const tp2 = analysis?.risk_management?.take_profit_2;
        const tp3 = analysis?.risk_management?.take_profit_3;
        const positionSide = side === "BUY" ? "LONG" : "SHORT";
        // True Breakeven: entry ± 0.12% (open fee + close fee + slippage buffer)
        const trueBreakeven = positionSide === "LONG"
          ? entryPrice * (1 + 0.0012)
          : entryPrice * (1 - 0.0012);
        const partialSize = parseFloat((roundedQty * 0.3333).toFixed(8));

        await supabase.from("trade_positions").insert({
          user_id: user.id,
          analysis_id: historyRecord?.id || null,
          symbol,
          side: positionSide,
          trade_state: "ACTIVE",
          original_size: roundedQty,
          total_position_size: roundedQty,
          current_avg_price: entryPrice,
          true_breakeven_price: trueBreakeven,
          accumulated_fees: roundedQty * entryPrice * 0.0005,
          partial_size: partialSize,
          entry_price: entryPrice,
          stop_loss_original: stopLoss,
          stop_loss_current: stopLoss,
          take_profit_1: tp1,
          take_profit_2: tp2 || null,
          take_profit_3: tp3 || null,
          leverage: actualLeverage,
          risk_pct: riskPct,
          entry_order_id: entryResult.orderId?.toString() || null,
          dca_history: [{ price: entryPrice, qty: roundedQty, time: new Date().toISOString() }],
        });

        results.push({
          asset,
          signal,
          confidence,
          executed: true,
          side,
          quantity: roundedQty,
          leverage: actualLeverage,
          stopLoss,
          takeProfit: tp1,
          orderId: entryResult.orderId,
        });
      } catch (assetError) {
        console.error(`[AUTOTRADE] Error processing ${asset}:`, assetError);
        results.push({
          asset,
          executed: false,
          reason:
            assetError instanceof Error
              ? assetError.message
              : "Unknown error",
        });
      }
    }

    return new Response(JSON.stringify({ results, timestamp: Date.now() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("autotrade-engine error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
