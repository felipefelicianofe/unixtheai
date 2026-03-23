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

    console.log("[run-auto-analyses] Starting scheduled run...");

    // Fetch all active configs
    const { data: configs, error: cfgErr } = await supabase
      .from("auto_analysis_configs")
      .select("*")
      .eq("is_active", true);

    if (cfgErr) {
      console.error("[run-auto-analyses] Error fetching configs:", cfgErr.message);
      return new Response(JSON.stringify({ error: cfgErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!configs || configs.length === 0) {
      console.log("[run-auto-analyses] No active configs found.");
      return new Response(JSON.stringify({ message: "No active configs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    let processed = 0;

    for (const config of configs) {
      // Check if enough time has elapsed since last run
      if (config.last_run_at) {
        const lastRun = new Date(config.last_run_at);
        const elapsedMinutes = (now.getTime() - lastRun.getTime()) / 60000;
        if (elapsedMinutes < config.analysis_period_minutes) {
          console.log(`[run-auto-analyses] Skipping ${config.asset} ${config.timeframe} — only ${elapsedMinutes.toFixed(1)}m elapsed (need ${config.analysis_period_minutes}m)`);
          continue;
        }
      }

      console.log(`[run-auto-analyses] Running analysis for ${config.asset} ${config.timeframe}...`);

      try {
        // Add delay between sequential calls to avoid rate limiting
        if (processed > 0) {
          console.log(`[run-auto-analyses] Waiting 5s before next analysis...`);
          await new Promise(r => setTimeout(r, 5000));
        }

        // Call the analyze-asset edge function with retry on 503
        const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-asset`;
        let analyzeResponse: Response | null = null;
        const maxRetries = 2;
        
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
          
          // If 503 (no real data), retry after delay
          if (analyzeResponse.status === 503 && attempt < maxRetries) {
            const retryDelay = (attempt + 1) * 5000;
            console.warn(`[run-auto-analyses] ${config.asset}: No real data (503), retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(r => setTimeout(r, retryDelay));
            continue;
          }
        }

        if (!analyzeResponse || !analyzeResponse.ok) {
          const errText = analyzeResponse ? await analyzeResponse.text() : "No response";
          console.error(`[run-auto-analyses] Analysis failed for ${config.asset}: ${errText}`);
          continue;
        }

        const result = await analyzeResponse.json();

        // Extract fields from analysis result
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

        // Insert into auto_analysis_history
        // NEUTRAL signals: no price targets, status = NEUTRAL (not verifiable)
        const { error: insertErr } = await supabase
          .from("auto_analysis_history")
          .insert({
            config_id: config.id,
            asset: config.asset,
            timeframe: config.timeframe,
            signal: signal,
            signal_strength_pct: header.signal_strength_pct || null,
            final_confidence_pct: header.final_confidence_pct || null,
            entry_price: isNeutral ? null : (rm.entry_price || null),
            stop_loss: isNeutral ? null : (rm.stop_loss || null),
            take_profit_1: isNeutral ? null : (rm.take_profit_1 || null),
            take_profit_2: isNeutral ? null : (rm.take_profit_2 || null),
            take_profit_3: isNeutral ? null : (rm.take_profit_3 || null),
            trend: header.trend || null,
            risk_reward_ratio: isNeutral ? null : (rm.risk_reward_ratio || null),
            executive_summary: result.institutional_synthesis?.executive_summary || null,
            full_result: result,
            status: isNeutral ? "NEUTRAL" : "PENDING",
          });

        if (insertErr) {
          console.error(`[run-auto-analyses] Insert failed for ${config.asset}:`, insertErr.message);
          continue;
        }

        // Update last_run_at
        const { error: updateErr } = await supabase
          .from("auto_analysis_configs")
          .update({ last_run_at: now.toISOString() })
          .eq("id", config.id);

        if (updateErr) {
          console.error(`[run-auto-analyses] Update last_run_at failed:`, updateErr.message);
        }

        processed++;
        console.log(`[run-auto-analyses] ✅ ${config.asset} ${config.timeframe} — Signal: ${header.signal}, Confidence: ${header.final_confidence_pct}%`);
      } catch (err) {
        console.error(`[run-auto-analyses] Error processing ${config.asset}:`, err);
      }
    }

    console.log(`[run-auto-analyses] Done. Processed ${processed}/${configs.length} configs.`);

    return new Response(
      JSON.stringify({ success: true, processed, total: configs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[run-auto-analyses] Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
