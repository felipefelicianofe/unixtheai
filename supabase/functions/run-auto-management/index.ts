import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log("[run-auto-management] Starting scheduled run...");

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

    // ── FIX #4: Determine which configs are ready to run ──
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

      readyConfigs.push(config);
    }

    if (readyConfigs.length === 0) {
      console.log(`[run-auto-management] No configs ready. (${skipped} skipped)`);
      return new Response(
        JSON.stringify({ success: true, processed: 0, skipped, total: configs.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── FIX #4: Process in batches of 2 (parallel) with 2s delay between batches ──
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
          const maxRetries = 1; // Reduced from 2 to save time

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
          const signal = normalizedSignal === "BUY" || normalizedSignal === "LONG"
            ? "COMPRA"
            : normalizedSignal === "SELL" || normalizedSignal === "SHORT"
              ? "VENDA"
              : normalizedSignal;
          const isNeutral = signal === "NEUTRO" || signal === "NEUTRAL";

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
              current_stop_loss: isNeutral ? null : (rm.stop_loss || null), // Initialize current_stop_loss = stop_loss
              take_profit_1: isNeutral ? null : (rm.take_profit_1 || null),
              take_profit_2: isNeutral ? null : (rm.take_profit_2 || null),
              take_profit_3: isNeutral ? null : (rm.take_profit_3 || null),
              trend: header.trend || null,
              risk_reward_ratio: isNeutral ? null : (rm.risk_reward_ratio || null),
              executive_summary: result.institutional_synthesis?.executive_summary || null,
              full_result: result,
              status: isNeutral ? "NEUTRAL" : "PENDING",
            });

          if (insertErr) throw new Error(`Insert failed for ${config.asset}: ${insertErr.message}`);

          await supabase
            .from("auto_management_configs")
            .update({ last_run_at: now.toISOString() })
            .eq("id", config.id);

          console.log(`[run-auto-management] ✅ ${config.asset} ${config.timeframe} — Signal: ${signal}, Confidence: ${header.final_confidence_pct}%`);
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

    console.log(`[run-auto-management] Done. Processed ${processed}/${readyConfigs.length} (${skipped} skipped).`);

    return new Response(
      JSON.stringify({ success: true, processed, skipped, total: configs.length }),
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
