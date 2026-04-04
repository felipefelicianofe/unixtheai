import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get today's date (UTC)
    const today = new Date();
    const reportDate = today.toISOString().slice(0, 10);

    // Get yesterday boundaries
    const startOfDay = new Date(today);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Fetch all signals closed today
    const { data: closedToday } = await supabase
      .from("auto_management_history")
      .select("asset, timeframe, status, signal, virtual_pnl_pct, entry_price, close_reason")
      .gte("closed_at", startOfDay.toISOString())
      .lte("closed_at", endOfDay.toISOString())
      .is("deleted_at", null);

    // Also count signals created today
    const { data: createdToday } = await supabase
      .from("auto_management_history")
      .select("asset, signal, status")
      .gte("created_at", startOfDay.toISOString())
      .lte("created_at", endOfDay.toISOString())
      .is("deleted_at", null);

    const closed = closedToday || [];
    const created = createdToday || [];

    const wins = closed.filter((r) => r.status?.startsWith("WIN"));
    const losses = closed.filter((r) => r.status === "LOSS");
    const neutral = closed.filter((r) => r.status === "NEUTRAL");

    const totalFinalized = wins.length + losses.length;
    const winRate = totalFinalized > 0 ? (wins.length / totalFinalized) * 100 : 0;

    // Best/Worst signal by PnL
    let bestSignal = null;
    let worstSignal = null;
    let bestPnl = -Infinity;
    let worstPnl = Infinity;

    for (const s of closed) {
      const pnl = s.virtual_pnl_pct || 0;
      if (pnl > bestPnl) { bestPnl = pnl; bestSignal = s; }
      if (pnl < worstPnl) { worstPnl = pnl; worstSignal = s; }
    }

    // Breakdown by asset
    const byAsset: Record<string, { wins: number; losses: number; total: number }> = {};
    for (const s of closed) {
      if (!byAsset[s.asset]) byAsset[s.asset] = { wins: 0, losses: 0, total: 0 };
      byAsset[s.asset].total++;
      if (s.status?.startsWith("WIN")) byAsset[s.asset].wins++;
      if (s.status === "LOSS") byAsset[s.asset].losses++;
    }

    // Breakdown by timeframe
    const byTF: Record<string, { wins: number; losses: number; total: number }> = {};
    for (const s of closed) {
      const tf = s.timeframe || "?";
      if (!byTF[tf]) byTF[tf] = { wins: 0, losses: 0, total: 0 };
      byTF[tf].total++;
      if (s.status?.startsWith("WIN")) byTF[tf].wins++;
      if (s.status === "LOSS") byTF[tf].losses++;
    }

    // Upsert daily report
    const { error } = await supabase
      .from("daily_reports")
      .upsert(
        {
          report_date: reportDate,
          total_signals: created.length,
          total_wins: wins.length,
          total_losses: losses.length,
          total_neutral: neutral.length,
          win_rate: winRate,
          best_signal: bestSignal ? {
            asset: bestSignal.asset,
            pnl: bestPnl,
            status: bestSignal.status,
          } : null,
          worst_signal: worstSignal ? {
            asset: worstSignal.asset,
            pnl: worstPnl,
            status: worstSignal.status,
          } : null,
          breakdown_by_asset: byAsset,
          breakdown_by_timeframe: byTF,
        },
        { onConflict: "report_date" }
      );

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        report_date: reportDate,
        total_signals: created.length,
        win_rate: winRate.toFixed(1),
        wins: wins.length,
        losses: losses.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
