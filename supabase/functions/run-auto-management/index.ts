import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════
// Quality Gate Thresholds (10-Point Improvement Plan)
// ═══════════════════════════════════════════════════════════
const MIN_CONFIDENCE_PCT = 50;         // #1 - Reject signals below 50%
const HTF_MANDATORY = true;           // #3 - Kill Zone: HTF disagreement = NEUTRAL
const RSI_OVERBOUGHT = 70;            // #5 - No BUY above 70
const RSI_OVERSOLD = 30;              // #5 - No SELL below 30
const BACKTEST_MIN_WINRATE = 35;      // #9 - Backtest gate (calibrated from 40→35)
const LOSS_COOLDOWN_MULTIPLIER = 2;   // #10 - 2x analysis_period cooldown after loss

// ═══════════════════════════════════════════════════════════
// Helper: Apply quality filters to analysis result
// ═══════════════════════════════════════════════════════════
interface QualityResult {
  passed: boolean;
  reason?: string;
  overrideToNeutral: boolean;
}

function applyQualityFilters(result: any, signal: string): QualityResult {
  const header = result.header || {};
  const rm = result.risk_management || {};
  const ti = result.technical_indicators || {};

  // Skip filters for neutral signals
  if (signal === "NEUTRO" || signal === "NEUTRAL") {
    return { passed: true, overrideToNeutral: false };
  }

  // #1 - Confidence Gate
  const confidence = header.final_confidence_pct || 0;
  if (confidence < MIN_CONFIDENCE_PCT) {
    return { passed: false, reason: `LOW_CONFIDENCE(${confidence}%<${MIN_CONFIDENCE_PCT}%)`, overrideToNeutral: true };
  }

  // #2 - Confluence threshold
  const confluence = result._master?.quality_score || result.technical_indicators?.confluence?.confidence || 0;
  // Use signal_strength as proxy for confluence if no explicit value
  const effectiveConfluence = confluence > 0 ? confluence : (header.signal_strength_pct || 0);
  if (effectiveConfluence < MIN_CONFLUENCE_PCT) {
    return { passed: false, reason: `LOW_CONFLUENCE(${effectiveConfluence}%<${MIN_CONFLUENCE_PCT}%)`, overrideToNeutral: true };
  }

  // #3 - HTF Mandatory Kill Zone
  if (HTF_MANDATORY && result._htf_bias) {
    const htfBias = result._htf_bias;
    const isBuy = signal === "COMPRA";
    const isSell = signal === "VENDA";
    if ((isBuy && htfBias === "SELL") || (isSell && htfBias === "BUY")) {
      return { passed: false, reason: `HTF_DISAGREEMENT(signal=${signal},htf=${htfBias})`, overrideToNeutral: true };
    }
  }

  // #4 - Volume filter
  const volumeProfile = ti.volume_profile || "";
  if (typeof volumeProfile === "string" && volumeProfile.toLowerCase().includes("low")) {
    // Also check volume_delta if available
    const vd = result._volume_delta;
    if (!vd || (vd.ratio && vd.ratio < MIN_VOLUME_RATIO)) {
      return { passed: false, reason: `LOW_VOLUME(profile=${volumeProfile})`, overrideToNeutral: true };
    }
  }

  // #5 - RSI Momentum Filter
  const rsi = ti.rsi?.value ?? null;
  if (rsi !== null) {
    if (signal === "COMPRA" && rsi > RSI_OVERBOUGHT) {
      return { passed: false, reason: `RSI_OVERBOUGHT(${rsi}>${RSI_OVERBOUGHT})`, overrideToNeutral: true };
    }
    if (signal === "VENDA" && rsi < RSI_OVERSOLD) {
      return { passed: false, reason: `RSI_OVERSOLD(${rsi}<${RSI_OVERSOLD})`, overrideToNeutral: true };
    }
  }

  // #6 - ATR Volatility Gate
  const atrPercentile = result._atr_percentile?.percentile ?? null;
  if (atrPercentile !== null && atrPercentile < ATR_PERCENTILE_MIN) {
    return { passed: false, reason: `LOW_ATR_VOLATILITY(${atrPercentile}th<${ATR_PERCENTILE_MIN}th)`, overrideToNeutral: true };
  }

  // #7 - Risk:Reward minimum
  const entry = rm.entry_price || 0;
  const sl = rm.stop_loss || 0;
  const tp1 = rm.take_profit_1 || 0;
  if (entry > 0 && sl > 0 && tp1 > 0) {
    const slDistance = Math.abs(entry - sl);
    const tp1Distance = Math.abs(tp1 - entry);
    if (slDistance > 0) {
      const rr = tp1Distance / slDistance;
      if (rr < MIN_RR_RATIO) {
        return { passed: false, reason: `LOW_RR(${rr.toFixed(2)}<${MIN_RR_RATIO})`, overrideToNeutral: true };
      }
    }
  }

  // #9 - Backtest gate
  const backtest = result._backtest;
  if (backtest && backtest.total >= 5) {
    if (backtest.winRate < BACKTEST_MIN_WINRATE) {
      return { passed: false, reason: `LOW_BACKTEST_WR(${backtest.winRate}%<${BACKTEST_MIN_WINRATE}%)`, overrideToNeutral: true };
    }
  }

  return { passed: true, overrideToNeutral: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log("[run-auto-management] Starting scheduled run...");

    // ── Cleanup: hard-delete neutral signals older than 1 hour ──
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: deletedNeutrals, error: cleanupErr } = await supabase
      .from("auto_management_history")
      .delete()
      .in("signal", ["NEUTRO", "NEUTRAL"])
      .in("status", ["NEUTRAL", "PENDING"])
      .lt("created_at", oneHourAgo)
      .select("id");

    if (cleanupErr) {
      console.warn("[run-auto-management] Neutral cleanup error:", cleanupErr.message);
    } else {
      console.log(`[run-auto-management] Cleaned up ${deletedNeutrals?.length || 0} old neutral records`);
    }

    const { data: configs, error: cfgErr } = await supabase
      .from("auto_management_configs")
      .select("*")
      .eq("is_active", true);

    if (cfgErr) {
      console.error("[run-auto-management] Error fetching configs:", cfgErr.message);
      return new Response(JSON.stringify({ error: cfgErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!configs || configs.length === 0) {
      console.log("[run-auto-management] No active configs found.");
      return new Response(JSON.stringify({ message: "No active configs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    let processed = 0;
    let skipped = 0;
    let filtered = 0;

    const readyConfigs: typeof configs = [];
    for (const config of configs) {
      if (config.last_run_at) {
        const elapsedMinutes = (now.getTime() - new Date(config.last_run_at).getTime()) / 60000;
        if (elapsedMinutes < config.analysis_period_minutes) {
          skipped++;
          continue;
        }
      }

      // Check for existing active signal
      const { data: activeSignals } = await supabase
        .from("auto_management_history")
        .select("id, signal, status")
        .eq("asset", config.asset)
        .in("status", ["PENDING", "WIN_TP1", "WIN_TP2"])
        .not("signal", "in", '("NEUTRO","NEUTRAL")')
        .is("deleted_at", null)
        .is("closed_at", null)
        .limit(1);

      if (activeSignals && activeSignals.length > 0) {
        console.log(`[run-auto-management] 🔒 SKIPPING ${config.asset} — Active signal exists`);
        await supabase
          .from("auto_management_configs")
          .update({ last_run_at: now.toISOString() })
          .eq("id", config.id);
        skipped++;
        continue;
      }

      // #10 - Loss Cooldown: check last closed signal for this asset
      const { data: lastLoss } = await supabase
        .from("auto_management_history")
        .select("closed_at, close_reason")
        .eq("asset", config.asset)
        .eq("status", "LOSS")
        .order("closed_at", { ascending: false })
        .limit(1);

      if (lastLoss && lastLoss.length > 0 && lastLoss[0].closed_at) {
        const lossCooldownMs = config.analysis_period_minutes * LOSS_COOLDOWN_MULTIPLIER * 60 * 1000;
        const timeSinceLoss = now.getTime() - new Date(lastLoss[0].closed_at).getTime();
        if (timeSinceLoss < lossCooldownMs) {
          const remainingMin = Math.ceil((lossCooldownMs - timeSinceLoss) / 60000);
          console.log(`[run-auto-management] ❄️ COOLDOWN ${config.asset} — Loss ${remainingMin}min ago, waiting ${remainingMin}min more`);
          skipped++;
          continue;
        }
      }

      readyConfigs.push(config);
    }

    if (readyConfigs.length === 0) {
      console.log(`[run-auto-management] No configs ready. (${skipped} skipped)`);
      return new Response(
        JSON.stringify({ success: true, processed: 0, skipped, filtered: 0, total: configs.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process in batches of 2
    const BATCH_SIZE = 2;
    const BATCH_DELAY_MS = 2000;

    for (let i = 0; i < readyConfigs.length; i += BATCH_SIZE) {
      const batch = readyConfigs.slice(i, i + BATCH_SIZE);

      if (i > 0) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }

      const results = await Promise.allSettled(
        batch.map(async (config) => {
          console.log(`[run-auto-management] Running analysis for ${config.asset} ${config.timeframe}...`);

          const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-asset`;
          let analyzeResponse: Response | null = null;
          const maxRetries = 1;

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            analyzeResponse = await fetch(analyzeUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                asset: config.asset,
                timeframe: config.timeframe,
              }),
            });

            if (analyzeResponse.ok) break;

            if (analyzeResponse.status === 503 && attempt < maxRetries) {
              console.warn(`[run-auto-management] ${config.asset}: 503, retrying...`);
              await new Promise(r => setTimeout(r, 3000));
              continue;
            }
          }

          if (!analyzeResponse || !analyzeResponse.ok) {
            const errText = analyzeResponse ? await analyzeResponse.text() : "No response";
            throw new Error(`Analysis failed for ${config.asset}: ${errText}`);
          }

          const result = await analyzeResponse.json();
          const header = result.header || {};
          const rm = result.risk_management || {};
          const rawSignal = String(header.signal || "NEUTRO");
          const normalizedSignal = rawSignal.trim().toUpperCase();
          let signal = normalizedSignal === "BUY" || normalizedSignal === "LONG"
            ? "COMPRA"
            : normalizedSignal === "SELL" || normalizedSignal === "SHORT"
              ? "VENDA"
              : normalizedSignal;
          let isNeutral = signal === "NEUTRO" || signal === "NEUTRAL";
          let filterReason: string | null = null;

          // ═══════════════════════════════════════════
          // Apply 10-Point Quality Filters
          // ═══════════════════════════════════════════
          if (!isNeutral) {
            const quality = applyQualityFilters(result, signal);
            if (!quality.passed && quality.overrideToNeutral) {
              console.log(`[run-auto-management] 🚫 FILTERED ${config.asset} ${signal} → NEUTRO | Reason: ${quality.reason}`);
              filterReason = quality.reason || "QUALITY_FILTER";
              signal = "NEUTRO";
              isNeutral = true;
              filtered++;
            }
          }

          const { error: insertErr } = await supabase
            .from("auto_management_history")
            .insert({
              config_id: config.id,
              asset: config.asset,
              timeframe: config.timeframe,
              signal,
              signal_strength_pct: header.signal_strength_pct || null,
              final_confidence_pct: header.final_confidence_pct || null,
              entry_price: isNeutral ? null : (rm.entry_price || null),
              stop_loss: isNeutral ? null : (rm.stop_loss || null),
              current_stop_loss: isNeutral ? null : (rm.stop_loss || null),
              take_profit_1: isNeutral ? null : (rm.take_profit_1 || null),
              take_profit_2: isNeutral ? null : (rm.take_profit_2 || null),
              take_profit_3: isNeutral ? null : (rm.take_profit_3 || null),
              trend: header.trend || null,
              risk_reward_ratio: isNeutral ? null : (rm.risk_reward_ratio || null),
              executive_summary: filterReason
                ? `[FILTRADO: ${filterReason}] ${result.institutional_synthesis?.executive_summary || ""}`
                : (result.institutional_synthesis?.executive_summary || null),
              full_result: result,
              status: isNeutral ? "NEUTRAL" : "PENDING",
            });

          if (insertErr) throw new Error(`Insert failed for ${config.asset}: ${insertErr.message}`);

          await supabase
            .from("auto_management_configs")
            .update({ last_run_at: now.toISOString() })
            .eq("id", config.id);

          const emoji = isNeutral ? (filterReason ? "🚫" : "⚪") : "✅";
          console.log(`[run-auto-management] ${emoji} ${config.asset} ${config.timeframe} — Signal: ${signal}, Confidence: ${header.final_confidence_pct}%${filterReason ? ` [${filterReason}]` : ""}`);
          return config.asset;
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          processed++;
        } else {
          console.error(`[run-auto-management] ❌ ${result.reason}`);
        }
      }
    }

    console.log(`[run-auto-management] Done. Processed ${processed}/${readyConfigs.length} (${skipped} skipped, ${filtered} filtered to NEUTRAL).`);

    return new Response(
      JSON.stringify({ success: true, processed, skipped, filtered, total: configs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[run-auto-management] Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
