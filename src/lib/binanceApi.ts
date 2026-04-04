import { supabase } from "@/integrations/supabase/client";
import type { ConnectionStatus, Position } from "@/lib/tradingEngine";

/**
 * Helper: invoke edge function and extract meaningful error details.
 * supabase.functions.invoke returns { data, error }.
 * When the function returns non-2xx, `error.message` is generic
 * ("Edge Function returned a non-2xx status code") and the actual
 * error payload is in `data` (parsed JSON body) or `error.context`.
 */
async function invokeEdgeFunction(
  functionName: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    // Try to extract the real error message from the response body
    let realMessage = error.message;

    // The SDK puts the response body in `data` even on error
    if (data && typeof data === "object" && data.error) {
      realMessage = data.error;
    } else if (data && typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        if (parsed.error) realMessage = parsed.error;
      } catch {
        realMessage = data;
      }
    }

    // If still generic, check context
    if (
      realMessage === "Edge Function returned a non-2xx status code" &&
      error.context
    ) {
      try {
        const ctx =
          error.context instanceof Response
            ? await error.context.json()
            : error.context;
        if (ctx?.error) realMessage = ctx.error;
      } catch {
        // keep generic
      }
    }

    throw new Error(realMessage);
  }

  // Even on success, check if the data itself contains an error
  if (data && typeof data === "object" && data.error) {
    throw new Error(data.error);
  }

  return data;
}

// Binance Proxy API calls
export async function fetchRealAccountInfo(): Promise<ConnectionStatus> {
  return invokeEdgeFunction("binance-proxy", {
    action: "account_info",
  }) as Promise<ConnectionStatus>;
}

export async function fetchRealPositions(): Promise<Position[]> {
  const data = await invokeEdgeFunction("binance-proxy", {
    action: "positions",
  });
  return (data || []) as Position[];
}

export async function closePosition(
  symbol: string,
  side: "LONG" | "SHORT",
  size: number
) {
  const closeSide = side === "LONG" ? "SELL" : "BUY";
  const cleanSymbol = symbol.replace("/", "");

  return invokeEdgeFunction("binance-proxy", {
    action: "place_order",
    symbol: cleanSymbol,
    side: closeSide,
    type: "MARKET",
    quantity: size,
    reduceOnly: true,
  });
}

export async function panicCloseAll() {
  return invokeEdgeFunction("binance-proxy", { action: "cancel_all" });
}

export async function runAutotradeEngine(
  assets?: string[],
  timeframe?: string
) {
  return invokeEdgeFunction("autotrade-engine", { assets, timeframe });
}

// ── Public Binance Data (via edge function proxy — no geo-block) ──

/**
 * Fetch current price for a single symbol via edge function proxy.
 * Used for REST fallback and monitoring — zero geo-block risk.
 */
export async function fetchBinancePrice(symbol: string): Promise<number | null> {
  try {
    const data = await invokePublicProxy({ action: "ticker_price", symbol: symbol.toUpperCase() });
    return (data as any)?.price ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch current prices for multiple symbols in a single request via proxy.
 * Returns a Map of symbol → price.
 */
export async function fetchBinancePricesBatch(symbols: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  try {
    const data = await invokePublicProxy({
      action: "ticker_prices_batch",
      symbols: symbols.map(s => s.toUpperCase()),
    });
    if (data && typeof data === "object") {
      for (const [symbol, price] of Object.entries(data as Record<string, number>)) {
        prices.set(symbol, price);
      }
    }
  } catch {
    // On error, return empty map — caller handles gracefully
  }
  return prices;
}

/**
 * Fetch full 24h ticker for a single symbol via proxy.
 */
export async function fetchBinanceTicker24h(symbol: string) {
  try {
    return await invokePublicProxy({ action: "ticker_24h", symbol: symbol.toUpperCase() });
  } catch {
    return null;
  }
}

/**
 * Invoke the public binance-public edge function (no auth required).
 */
async function invokePublicProxy(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("binance-public", { body });

  if (error) {
    let msg = error.message;
    if (data && typeof data === "object" && (data as any).error) {
      msg = (data as any).error;
    }
    throw new Error(msg);
  }

  if (data && typeof data === "object" && (data as any).error) {
    throw new Error((data as any).error);
  }

  return data;
}
