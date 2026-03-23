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

    console.log("[reprocess-history] Starting full reprocessing...");

    // Step 1: Mark ALL existing non-deleted analyses as _legacy_bias
    const { data: existing, error: fetchErr } = await supabase
      .from("auto_analysis_history")
      .select("id, full_result")
      .is("deleted_at", null);

    if (fetchErr) {
      console.error("[reprocess-history] Failed to fetch existing:", fetchErr.message);
    } else if (existing && existing.length > 0) {
      let marked = 0;
      for (const entry of existing) {
        const fullResult = (entry.full_result || {}) as Record<string, any>;
        if (!fullResult._legacy_bias) {
          fullResult._legacy_bias = true;
          fullResult._legacy_bias_marked_at = new Date().toISOString();
          const { error: updateErr } = await supabase
            .from("auto_analysis_history")
            .update({ full_result: fullResult })
            .eq("id", entry.id);
          if (!updateErr) marked++;
        }
      }
      console.log(`[reprocess-history] Marked ${marked}/${existing.length} entries as _legacy_bias`);
    }

    // Step 2: Run new analyses for all active configs
    const { data: configs, error: cfgErr } = await supabase
      .from("auto_analysis_configs")
      .select("*")
      .eq("is_active", true);

    if (cfgErr) {
      console.error("[reprocess-history] Failed to fetch configs:", cfgErr.message);
      return new Response(JSON.stringify({ error: cfgErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let newAnalyses = 0;

    if (configs && configs.length > 0) {
      for (const config of configs) {
        try {
          if (newAnalyses > 0) {
            console.log(`[reprocess-history] Waiting 5s before next analysis...`);
            await new Promise(r => setTimeout(r, 5000));
          }

          console.log(`[reprocess-history] Analyzing ${config.asset} ${config.timeframe}...`);

          const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-asset`;
          let analyzeResponse: Response | null = null;

          for (let attempt = 0; attempt <= 2; attempt++) {
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
            if (analyzeResponse.status === 503 && attempt < 2) {
              await new Promise(r => setTimeout(r, (attempt + 1) * 5000));
              continue;
            }
          }

          if (!analyzeResponse || !analyzeResponse.ok) {
            const errText = analyzeResponse ? await analyzeResponse.text() : "No response";
            console.error(`[reprocess-history] Analysis failed for ${config.asset}: ${errText}`);
            continue;
          }

          const result = await analyzeResponse.json();
          const header = result.header || {};
          const rm = result.risk_management || {};
          const rawSignal = String(header.signal || "NEUTRO").trim().toUpperCase();
          const signal = rawSignal === "BUY" || rawSignal === "LONG"
            ? "COMPRA"
            : rawSignal === "SELL" || rawSignal === "SHORT"
              ? "VENDA"
              : rawSignal;
          const isNeutral = signal === "NEUTRO" || signal === "NEUTRAL";

          const { error: insertErr } = await supabase
            .from("auto_analysis_history")
            .insert({
              config_id: config.id,
              asset: config.asset,
              timeframe: config.timeframe,
              signal,
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
            console.error(`[reprocess-history] Insert failed for ${config.asset}:`, insertErr.message);
            continue;
          }

          // Update last_run_at
          await supabase
            .from("auto_analysis_configs")
            .update({ last_run_at: new Date().toISOString() })
            .eq("id", config.id);

          newAnalyses++;
          console.log(`[reprocess-history] ✅ ${config.asset} ${config.timeframe} — Signal: ${signal}, Confidence: ${header.final_confidence_pct}%`);
        } catch (err) {
          console.error(`[reprocess-history] Error processing ${config.asset}:`, err);
        }
      }
    }

    // Step 3: Re-verify all PENDING analyses
    console.log("[reprocess-history] Triggering verification of all PENDING analyses...");
    try {
      const verifyUrl = `${supabaseUrl}/functions/v1/verify-analyses-results`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({}),
      });
      if (verifyRes.ok) {
        const verifyResult = await verifyRes.json();
        console.log(`[reprocess-history] Verification complete:`, JSON.stringify(verifyResult));
      } else {
        console.error(`[reprocess-history] Verification failed: ${await verifyRes.text()}`);
      }
    } catch (err) {
      console.error("[reprocess-history] Verification error:", err);
    }

    const summary = {
      success: true,
      legacy_entries_marked: existing?.length || 0,
      new_analyses: newAnalyses,
      total_configs: configs?.length || 0,
    };

    console.log(`[reprocess-history] Done.`, JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[reprocess-history] Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
