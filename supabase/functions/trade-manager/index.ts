import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================
// CONSTANTS
// ============================================================

const FEE_TAKER = 0.0005; // 0.05% Binance Futures Taker
const FEE_MAKER = 0.0002; // 0.02% Binance Futures Maker
const SLIPPAGE_BUFFER = 0.0002; // 0.02% safety margin for STOP_MARKET slippage
const PARTIAL_PCT = 0.3333; // 33.33% per TP level

// ============================================================
// TRUE BREAKEVEN CALCULATION
// ============================================================

function calcTrueBreakeven(
  avgPrice: number,
  side: "LONG" | "SHORT",
  totalFees?: number
): number {
  // Default: Taker open + Taker close + slippage buffer = 0.12% total
  const feeRate = totalFees ?? (FEE_TAKER + FEE_TAKER + SLIPPAGE_BUFFER);
  if (side === "LONG") {
    return avgPrice * (1 + feeRate);
  } else {
    return avgPrice * (1 - feeRate);
  }
}

// ============================================================
// DCA: WEIGHTED AVERAGE PRICE
// ============================================================

function calcWeightedAvgPrice(
  currentQty: number,
  currentAvgPrice: number,
  newQty: number,
  newPrice: number
): { totalQty: number; avgPrice: number } {
  const totalQty = currentQty + newQty;
  const avgPrice =
    (currentQty * currentAvgPrice + newQty * newPrice) / totalQty;
  return { totalQty, avgPrice };
}

// ============================================================
// BINANCE PROXY HELPER
// ============================================================

async function callBinanceProxy(
  supabaseUrl: string,
  authHeader: string,
  apikey: string,
  body: Record<string, unknown>
): Promise<Record<string, any>> {
  const res = await fetch(`${supabaseUrl}/functions/v1/binance-proxy`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      apikey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ============================================================
// MAIN HANDLER
// ============================================================

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

    const body = await req.json();
    const { action } = body;

    // ========================================================
    // ACTION: create_position
    // Called after autotrade-engine places the entry order
    // ========================================================
    if (action === "create_position") {
      const {
        symbol, side, size, entry_price, stop_loss, take_profit_1,
        take_profit_2, take_profit_3, leverage, risk_pct,
        entry_order_id, sl_order_id, analysis_id, tp_type,
      } = body;

      const trueBreakeven = calcTrueBreakeven(entry_price, side);
      const partialSize = parseFloat((size * PARTIAL_PCT).toFixed(8));

      const { data: pos, error: insertErr } = await supabase
        .from("trade_positions")
        .insert({
          user_id: user.id,
          analysis_id: analysis_id || null,
          symbol,
          side,
          trade_state: "ACTIVE",
          original_size: size,
          total_position_size: size,
          current_avg_price: entry_price,
          true_breakeven_price: trueBreakeven,
          accumulated_fees: size * entry_price * FEE_TAKER, // open fee
          partial_size: partialSize,
          entry_price,
          stop_loss_original: stop_loss,
          stop_loss_current: stop_loss,
          take_profit_1,
          take_profit_2: take_profit_2 || null,
          take_profit_3: take_profit_3 || null,
          tp_type: tp_type || "FIXED_PRICE",
          leverage: leverage || 1,
          risk_pct: risk_pct || 2,
          entry_order_id: entry_order_id || null,
          sl_order_id: sl_order_id || null,
          dca_history: [{ price: entry_price, qty: size, time: new Date().toISOString() }],
        })
        .select()
        .single();

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[trade-manager] Created position ${pos.id}: ${side} ${size} ${symbol} @ ${entry_price}`);
      return new Response(JSON.stringify({ success: true, position: pos }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================================
    // ACTION: check_and_advance
    // Monitors price and advances state machine
    // ========================================================
    if (action === "check_and_advance") {
      const { position_id, current_price } = body;

      const { data: pos, error: fetchErr } = await supabase
        .from("trade_positions")
        .select("*")
        .eq("id", position_id)
        .eq("user_id", user.id)
        .single();

      if (fetchErr || !pos) {
        return new Response(JSON.stringify({ error: "Position not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (pos.trade_state === "CLOSED") {
        return new Response(JSON.stringify({ message: "Position already closed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isLong = pos.side === "LONG";
      const price = current_price as number;
      const now = new Date().toISOString();
      const updates: Record<string, any> = { unrealized_pnl: 0 };
      const actions: string[] = [];

      // Calculate unrealized P&L
      if (isLong) {
        updates.unrealized_pnl = ((price - pos.current_avg_price) / pos.current_avg_price) * 100;
      } else {
        updates.unrealized_pnl = ((pos.current_avg_price - price) / pos.current_avg_price) * 100;
      }

      // ---- CHECK STOP LOSS HIT ----
      const slHit = isLong ? price <= pos.stop_loss_current : price >= pos.stop_loss_current;

      if (slHit) {
        // Determine final state based on current trade_state
        const finalState = "CLOSED";
        const closeReason = pos.trade_state === "TP2_HIT" 
          ? "WIN_TP2_THEN_SL" 
          : (pos.trade_state === "TP1_HIT" ? "WIN_TP1_THEN_SL" : "LOSS");

        updates.trade_state = finalState;
        updates.sl_filled_at = now;
        updates.closed_at = now;
        updates.close_reason = closeReason;
        actions.push(`SL hit at ${price}. State: ${pos.trade_state} → CLOSED (${closeReason})`);

        // Close remaining position via Binance
        const closeSide = isLong ? "SELL" : "BUY";
        const remaining = pos.total_position_size;
        if (remaining > 0) {
          await callBinanceProxy(supabaseUrl, authHeader, supabaseKey, {
            action: "place_order",
            symbol: pos.symbol,
            side: closeSide,
            type: "MARKET",
            quantity: remaining,
            reduceOnly: true,
          });
          actions.push(`Closed ${remaining} ${pos.symbol} at market (Reduce-Only)`);
        }

        // Cancel pending SL/TP orders
        await callBinanceProxy(supabaseUrl, authHeader, supabaseKey, {
          action: "cancel_all",
          symbol: pos.symbol,
        });
        actions.push("Cancelled all pending orders");

      } else {
        // ---- STATE MACHINE: TP ADVANCEMENT ----

        // PHASE 1: ACTIVE → TP1_HIT
        if (pos.trade_state === "ACTIVE") {
          const tp1Hit = isLong ? price >= pos.take_profit_1 : price <= pos.take_profit_1;
          if (tp1Hit) {
            const closeSide = isLong ? "SELL" : "BUY";

            // Action 1: Close 33.33% at market (Reduce-Only)
            const partialQty = parseFloat(pos.partial_size.toFixed(8));
            const closeResult = await callBinanceProxy(supabaseUrl, authHeader, supabaseKey, {
              action: "place_order",
              symbol: pos.symbol,
              side: closeSide,
              type: "MARKET",
              quantity: partialQty,
              reduceOnly: true,
            });
            actions.push(`TP1: Closed ${partialQty} ${pos.symbol} (Reduce-Only)`);

            // Action 2: Cancel old SL, place new SL at True Breakeven
            await callBinanceProxy(supabaseUrl, authHeader, supabaseKey, {
              action: "cancel_all",
              symbol: pos.symbol,
            });

            const remainingQty = parseFloat((pos.total_position_size - partialQty).toFixed(8));
            const slResult = await callBinanceProxy(supabaseUrl, authHeader, supabaseKey, {
              action: "place_order",
              symbol: pos.symbol,
              side: closeSide,
              type: "STOP_MARKET",
              quantity: remainingQty,
              stopPrice: pos.true_breakeven_price,
              reduceOnly: true,
            });
            actions.push(`New SL at True Breakeven: ${pos.true_breakeven_price}`);

            // Calculate partial realized PnL
            const partialPnl = isLong
              ? (price - pos.current_avg_price) * partialQty
              : (pos.current_avg_price - price) * partialQty;

            updates.trade_state = "TP1_HIT";
            updates.tp1_filled_at = now;
            updates.total_position_size = remainingQty;
            updates.stop_loss_current = pos.true_breakeven_price;
            updates.realized_pnl = (pos.realized_pnl || 0) + partialPnl;
            updates.sl_order_id = slResult?.orderId || null;
            // Recalculate partial_size for remaining
            updates.partial_size = parseFloat((remainingQty * 0.5).toFixed(8)); // 50% of remaining = ~33% of original
          }
        }

        // PHASE 2: TP1_HIT → TP2_HIT
        else if (pos.trade_state === "TP1_HIT" && pos.take_profit_2) {
          const tp2Hit = isLong ? price >= pos.take_profit_2 : price <= pos.take_profit_2;
          if (tp2Hit) {
            const closeSide = isLong ? "SELL" : "BUY";
            const partialQty = parseFloat(pos.partial_size.toFixed(8));

            // Action 1: Close partial at market
            await callBinanceProxy(supabaseUrl, authHeader, supabaseKey, {
              action: "place_order",
              symbol: pos.symbol,
              side: closeSide,
              type: "MARKET",
              quantity: partialQty,
              reduceOnly: true,
            });
            actions.push(`TP2: Closed ${partialQty} ${pos.symbol} (Reduce-Only)`);

            // Action 2: Cancel old SL, place new SL at TP1 price (trailing stop staircase)
            await callBinanceProxy(supabaseUrl, authHeader, supabaseKey, {
              action: "cancel_all",
              symbol: pos.symbol,
            });

            const remainingQty = parseFloat((pos.total_position_size - partialQty).toFixed(8));
            const slResult = await callBinanceProxy(supabaseUrl, authHeader, supabaseKey, {
              action: "place_order",
              symbol: pos.symbol,
              side: closeSide,
              type: "STOP_MARKET",
              quantity: remainingQty,
              stopPrice: pos.take_profit_1, // Trailing: SL moves to TP1
              reduceOnly: true,
            });
            actions.push(`New SL at TP1 price: ${pos.take_profit_1} (trailing staircase)`);

            const partialPnl = isLong
              ? (price - pos.current_avg_price) * partialQty
              : (pos.current_avg_price - price) * partialQty;

            updates.trade_state = "TP2_HIT";
            updates.tp2_filled_at = now;
            updates.total_position_size = remainingQty;
            updates.stop_loss_current = pos.take_profit_1;
            updates.realized_pnl = (pos.realized_pnl || 0) + partialPnl;
            updates.sl_order_id = slResult?.orderId || null;
            updates.partial_size = remainingQty; // TP3 closes 100% remaining
          }
        }

        // PHASE 3: TP2_HIT → CLOSED (TP3 = close all)
        else if (pos.trade_state === "TP2_HIT" && pos.take_profit_3) {
          const tp3Hit = isLong ? price >= pos.take_profit_3 : price <= pos.take_profit_3;
          if (tp3Hit) {
            const closeSide = isLong ? "SELL" : "BUY";
            const remainingQty = pos.total_position_size;

            // Close 100% remaining at market
            await callBinanceProxy(supabaseUrl, authHeader, supabaseKey, {
              action: "place_order",
              symbol: pos.symbol,
              side: closeSide,
              type: "MARKET",
              quantity: remainingQty,
              reduceOnly: true,
            });
            actions.push(`TP3: Closed ALL ${remainingQty} ${pos.symbol} (Reduce-Only)`);

            // Cancel all pending
            await callBinanceProxy(supabaseUrl, authHeader, supabaseKey, {
              action: "cancel_all",
              symbol: pos.symbol,
            });

            const partialPnl = isLong
              ? (price - pos.current_avg_price) * remainingQty
              : (pos.current_avg_price - price) * remainingQty;

            updates.trade_state = "CLOSED";
            updates.tp3_filled_at = now;
            updates.closed_at = now;
            updates.close_reason = "WIN_TP3";
            updates.total_position_size = 0;
            updates.realized_pnl = (pos.realized_pnl || 0) + partialPnl;
          }
        }
      }

      // Apply updates
      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await supabase
          .from("trade_positions")
          .update(updates)
          .eq("id", position_id);

        if (updateErr) {
          console.error(`[trade-manager] Update failed:`, updateErr.message);
        }
      }

      console.log(`[trade-manager] ${pos.symbol} ${position_id}: ${actions.join(" | ") || "No state change"}`);
      return new Response(
        JSON.stringify({
          success: true,
          position_id,
          trade_state: updates.trade_state || pos.trade_state,
          actions,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================
    // ACTION: dca_entry (Scaling In / DCA)
    // ========================================================
    if (action === "dca_entry") {
      const { position_id, new_price, new_qty } = body;

      const { data: pos, error: fetchErr } = await supabase
        .from("trade_positions")
        .select("*")
        .eq("id", position_id)
        .eq("user_id", user.id)
        .single();

      if (fetchErr || !pos) {
        return new Response(JSON.stringify({ error: "Position not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (pos.trade_state === "CLOSED") {
        return new Response(JSON.stringify({ error: "Cannot DCA into closed position" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Recalculate weighted average
      const { totalQty, avgPrice } = calcWeightedAvgPrice(
        pos.total_position_size,
        pos.current_avg_price,
        new_qty,
        new_price
      );

      // 2. Accumulate fees
      const newFee = new_qty * new_price * FEE_TAKER;
      const totalFees = pos.accumulated_fees + newFee;
      const feeRate = totalFees / (totalQty * avgPrice);

      // 3. Recalculate true breakeven with accumulated fees
      const trueBreakeven = calcTrueBreakeven(avgPrice, pos.side as "LONG" | "SHORT", feeRate + FEE_TAKER);

      // 4. New partial size
      const newPartialSize = parseFloat((totalQty * PARTIAL_PCT).toFixed(8));

      // 5. DCA history
      const dcaHistory = [...(pos.dca_history || []), { price: new_price, qty: new_qty, time: new Date().toISOString() }];

      // 6. Cancel and replace SL on Binance
      const closeSide = pos.side === "LONG" ? "SELL" : "BUY";
      await callBinanceProxy(supabaseUrl, authHeader, supabaseKey, {
        action: "cancel_all",
        symbol: pos.symbol,
      });

      // Place new SL with updated size at original invalidation price
      const slResult = await callBinanceProxy(supabaseUrl, authHeader, supabaseKey, {
        action: "place_order",
        symbol: pos.symbol,
        side: closeSide,
        type: "STOP_MARKET",
        quantity: totalQty,
        stopPrice: pos.stop_loss_original, // Keep original invalidation
        reduceOnly: true,
      });

      // 7. Recalculate TPs if PERCENTAGE type
      const updates: Record<string, any> = {
        total_position_size: totalQty,
        current_avg_price: avgPrice,
        true_breakeven_price: trueBreakeven,
        accumulated_fees: totalFees,
        partial_size: newPartialSize,
        dca_count: pos.dca_count + 1,
        dca_history: dcaHistory,
        sl_order_id: slResult?.orderId || null,
      };

      if (pos.tp_type === "PERCENTAGE") {
        // Recalculate TP levels from new average price
        const tp1Pct = (pos.take_profit_1 - pos.entry_price) / pos.entry_price;
        const isLong = pos.side === "LONG";
        updates.take_profit_1 = isLong ? avgPrice * (1 + tp1Pct) : avgPrice * (1 - tp1Pct);
        if (pos.take_profit_2) {
          const tp2Pct = (pos.take_profit_2 - pos.entry_price) / pos.entry_price;
          updates.take_profit_2 = isLong ? avgPrice * (1 + Math.abs(tp2Pct)) : avgPrice * (1 - Math.abs(tp2Pct));
        }
        if (pos.take_profit_3) {
          const tp3Pct = (pos.take_profit_3 - pos.entry_price) / pos.entry_price;
          updates.take_profit_3 = isLong ? avgPrice * (1 + Math.abs(tp3Pct)) : avgPrice * (1 - Math.abs(tp3Pct));
        }
      }

      const { error: updateErr } = await supabase
        .from("trade_positions")
        .update(updates)
        .eq("id", position_id);

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[trade-manager] DCA #${pos.dca_count + 1}: ${pos.symbol} +${new_qty} @ ${new_price} → Avg: ${avgPrice.toFixed(4)}, BE: ${trueBreakeven.toFixed(4)}`);
      return new Response(
        JSON.stringify({
          success: true,
          new_avg_price: avgPrice,
          true_breakeven: trueBreakeven,
          total_size: totalQty,
          partial_size: newPartialSize,
          dca_count: pos.dca_count + 1,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[trade-manager] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
