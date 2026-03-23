import { supabase } from "@/integrations/supabase/client";
import type { AnalysisResult } from "./analyze";

export async function saveAnalysisToHistory(result: AnalysisResult): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { header, risk_management, institutional_synthesis } = result;

  // Strip heavy candle data from stored JSON to save space
  const { _candles, ...lightResult } = result;

  const { error } = await supabase.from("analysis_history").insert({
    user_id: user.id,
    asset: header.asset,
    timeframe: header.timeframe,
    signal: header.signal,
    signal_strength_pct: header.signal_strength_pct,
    final_confidence_pct: header.final_confidence_pct,
    trend: header.trend,
    entry_price: risk_management?.entry_price,
    stop_loss: risk_management?.stop_loss,
    take_profit_1: risk_management?.take_profit_1,
    take_profit_2: risk_management?.take_profit_2,
    take_profit_3: risk_management?.take_profit_3,
    risk_reward_ratio: risk_management?.risk_reward_ratio,
    data_source: result._data_source,
    executive_summary: institutional_synthesis?.executive_summary,
    full_result: lightResult as never,
  });

  if (error) {
    console.error("Failed to save analysis:", error);
  }
}
