import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Binance spot endpoints — no API key needed, no geo-block from server */
const BINANCE_ENDPOINTS = [
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
  "https://data-api.binance.vision",
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchWithFallback(path: string): Promise<any> {
  for (const base of BINANCE_ENDPOINTS) {
    try {
      const res = await fetch(`${base}${path}`);
      if (res.ok) return await res.json();
      await res.text(); // consume body
    } catch {
      // try next
    }
  }
  throw new Error("All Binance endpoints failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }

    const { action } = body;

    switch (action) {
      case "ticker_price": {
        const symbol = String(body.symbol || "").toUpperCase();
        if (!symbol) return jsonResponse({ error: "symbol required" }, 400);
        const data = await fetchWithFallback(`/api/v3/ticker/price?symbol=${symbol}`);
        return jsonResponse({ symbol: data.symbol, price: parseFloat(data.price) });
      }

      case "ticker_prices_batch": {
        const symbols: string[] = body.symbols;
        if (!Array.isArray(symbols) || symbols.length === 0) {
          return jsonResponse({ error: "symbols array required" }, 400);
        }
        const param = JSON.stringify(symbols.map((s: string) => s.toUpperCase()));
        const data: Array<{ symbol: string; price: string }> = await fetchWithFallback(
          `/api/v3/ticker/price?symbols=${encodeURIComponent(param)}`
        );
        const result: Record<string, number> = {};
        for (const item of data) {
          result[item.symbol] = parseFloat(item.price);
        }
        return jsonResponse(result);
      }

      case "ticker_24h": {
        const symbol = String(body.symbol || "").toUpperCase();
        if (!symbol) return jsonResponse({ error: "symbol required" }, 400);
        const data = await fetchWithFallback(`/api/v3/ticker/24hr?symbol=${symbol}`);
        return jsonResponse({
          symbol: data.symbol,
          price: parseFloat(data.lastPrice),
          priceChange: parseFloat(data.priceChange),
          priceChangePercent: parseFloat(data.priceChangePercent),
          high24h: parseFloat(data.highPrice),
          low24h: parseFloat(data.lowPrice),
          volume24h: parseFloat(data.volume),
        });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[binance-public]", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
