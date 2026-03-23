import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BINANCE_MAINNET = "https://fapi.binance.com";
const BINANCE_TESTNET = "https://testnet.binancefuture.com";

class BinanceApiError extends Error {
  code: number | string;
  status: number;

  constructor(code: number | string, message: string, status: number) {
    super(message);
    this.name = "BinanceApiError";
    this.code = code;
    this.status = status;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatBinanceError(
  code: number | string,
  message: string,
  isTestnet: boolean
): string {
  const base = `Binance [${code}]: ${message}`;

  if (Number(code) === -2015) {
    return `${base}\n\nChecklist: 1) Ative permissão de Futures na chave. 2) Use chave do ambiente correto (${isTestnet ? "Testnet" : "Mainnet"}). 3) Em infraestrutura cloud sem IP fixo, não restrinja por IP. 4) Gere nova chave se mudou permissões recentemente.`;
  }

  if (Number(code) === -1021) {
    return `${base}\n\nO relógio da requisição está fora da janela permitida. Tente novamente em alguns segundos.`;
  }

  if (Number(code) === -1022) {
    return `${base}\n\nAssinatura inválida. Revise API Secret e remova espaços extras no início/fim.`;
  }

  return base;
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function binanceRequest(
  baseUrl: string,
  apiKey: string,
  apiSecret: string,
  method: string,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<any> {
  params.timestamp = Date.now().toString();
  params.recvWindow = "10000";

  const queryString = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const signature = await hmacSign(apiSecret, queryString);
  const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

  console.log(`[binance-proxy] ${method} ${baseUrl}${endpoint}`);

  const response = await fetch(url, {
    method,
    headers: {
      "X-MBX-APIKEY": apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const rawBody = await response.text();
  let data: any = {};

  try {
    data = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    data = { msg: rawBody || "Resposta não-JSON da Binance" };
  }

  if (!response.ok) {
    const binanceMsg = data?.msg || JSON.stringify(data);
    const binanceCode = data?.code ?? response.status;
    throw new BinanceApiError(binanceCode, binanceMsg, response.status);
  }

  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let currentIsTestnet = true;

  try {
    // 1) Session token (JWT) is used ONLY for app authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[binance-proxy] Missing or invalid authorization header");
      return jsonResponse({ error: "Não autenticado. Faça login novamente." }, 401);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return jsonResponse({ error: "Token inválido. Faça login novamente." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("[binance-proxy] Missing SUPABASE_URL or SUPABASE_ANON_KEY");
      return jsonResponse({ error: "Configuração do servidor incompleta." }, 500);
    }

    // 2) Validate JWT claims
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: claimsError } = await supabase.auth.getUser(token);

    if (claimsError || !user?.id) {
      console.error("[binance-proxy] JWT verification failed:", claimsError?.message);
      return jsonResponse({ error: "Token inválido. Faça login novamente." }, 401);
    }

    const userId = user.id;
    console.log(`[binance-proxy] Authenticated user: ${userId}`);

    // 3) Parse body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
    }

    const {
      action,
      apiKey: _ignoredBodyApiKey,
      apiSecret: _ignoredBodyApiSecret,
      ...actionParams
    } = body || {};

    if (_ignoredBodyApiKey || _ignoredBodyApiSecret) {
      console.warn("[binance-proxy] Ignoring apiKey/apiSecret sent in request body. Using stored broker credentials only.");
    }

    if (!action || typeof action !== "string") {
      return jsonResponse({ error: "Ação não especificada ou inválida." }, 400);
    }

    console.log(`[binance-proxy] Action: ${action}`);

    // 4) Fetch broker credentials from backend storage
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) {
      console.error("[binance-proxy] Missing SUPABASE_SERVICE_ROLE_KEY");
      return jsonResponse({ error: "Configuração do servidor incompleta." }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: creds, error: credsError } = await adminClient
      .from("broker_credentials")
      .select("api_key, api_secret, broker, is_testnet")
      .eq("user_id", userId)
      .maybeSingle();

    if (credsError) {
      console.error("[binance-proxy] Credentials query error:", credsError.message);
      return jsonResponse({ error: `Erro ao buscar credenciais: ${credsError.message}` }, 500);
    }

    if (!creds) {
      console.error("[binance-proxy] No credentials found for user:", userId);
      return jsonResponse({ error: "Nenhuma credencial encontrada. Conecte sua corretora primeiro." }, 400);
    }

    if (!creds.api_key || !creds.api_secret) {
      return jsonResponse({ error: "Credenciais incompletas. Insira API Key e Secret." }, 400);
    }

    currentIsTestnet = Boolean(creds.is_testnet);
    const baseUrl = currentIsTestnet ? BINANCE_TESTNET : BINANCE_MAINNET;
    const maskedKey = `${creds.api_key.slice(0, 6)}...${creds.api_key.slice(-4)}`;

    console.log(`[binance-proxy] Using ${currentIsTestnet ? "TESTNET" : "MAINNET"}: ${baseUrl}`);
    console.log(`[binance-proxy] Broker key prefix: ${maskedKey}`);

    // 5) Execute action against Binance Futures endpoints only (/fapi/...)
    let result: any;

    switch (action) {
      case "account_info": {
        result = await binanceRequest(baseUrl, creds.api_key, creds.api_secret, "GET", "/fapi/v2/account");
        const balance = result.totalWalletBalance ? parseFloat(result.totalWalletBalance) : 0;
        const available = result.availableBalance ? parseFloat(result.availableBalance) : 0;
        const unrealizedPnl = result.totalUnrealizedProfit ? parseFloat(result.totalUnrealizedProfit) : 0;
        result = {
          connected: true,
          pingMs: 0,
          accountBalance: balance,
          availableBalance: available,
          totalPnl: unrealizedPnl,
          totalMarginBalance: result.totalMarginBalance ? parseFloat(result.totalMarginBalance) : 0,
        };
        break;
      }

      case "positions": {
        const positions = await binanceRequest(baseUrl, creds.api_key, creds.api_secret, "GET", "/fapi/v2/positionRisk");
        result = positions
          .filter((p: any) => parseFloat(p.positionAmt) !== 0)
          .map((p: any) => ({
            id: `${p.symbol}-${p.positionSide}`,
            symbol: p.symbol.replace("USDT", "/USDT"),
            side: parseFloat(p.positionAmt) > 0 ? "LONG" : "SHORT",
            size: Math.abs(parseFloat(p.positionAmt)),
            entryPrice: parseFloat(p.entryPrice),
            currentPrice: parseFloat(p.markPrice),
            pnl: parseFloat(p.unRealizedProfit),
            roe:
              parseFloat(p.entryPrice) > 0
                ? ((parseFloat(p.markPrice) - parseFloat(p.entryPrice)) /
                    parseFloat(p.entryPrice)) *
                  parseFloat(p.leverage) *
                  100 *
                  (parseFloat(p.positionAmt) > 0 ? 1 : -1)
                : 0,
            stopLoss: 0,
            takeProfit: 0,
            leverage: parseInt(p.leverage),
            trailingActive: false,
            breakEven: false,
            timestamp: Date.now(),
            liquidationPrice: parseFloat(p.liquidationPrice),
          }));
        break;
      }

      case "open_orders": {
        result = await binanceRequest(
          baseUrl,
          creds.api_key,
          creds.api_secret,
          "GET",
          "/fapi/v1/openOrders",
          actionParams.symbol ? { symbol: String(actionParams.symbol) } : {}
        );
        break;
      }

      case "place_order": {
        const { symbol, side, type, quantity, price, stopPrice, reduceOnly, leverage } = actionParams;

        if (!symbol || !side || !type || quantity === undefined || quantity === null) {
          return jsonResponse(
            { error: "Parâmetros obrigatórios ausentes para place_order (symbol, side, type, quantity)." },
            400
          );
        }

        const numericQty = Number(quantity);
        if (!Number.isFinite(numericQty) || numericQty <= 0) {
          return jsonResponse({ error: "Quantidade inválida para place_order." }, 400);
        }

        if (leverage !== undefined && leverage !== null) {
          await binanceRequest(baseUrl, creds.api_key, creds.api_secret, "POST", "/fapi/v1/leverage", {
            symbol: String(symbol),
            leverage: Number(leverage).toString(),
          });
        }

        const orderParams: Record<string, string> = {
          symbol: String(symbol),
          side: String(side),
          type: String(type),
          quantity: numericQty.toString(),
        };

        if (price !== undefined && price !== null) orderParams.price = Number(price).toString();
        if (stopPrice !== undefined && stopPrice !== null) orderParams.stopPrice = Number(stopPrice).toString();
        if (reduceOnly) orderParams.reduceOnly = "true";
        if (String(type) === "LIMIT") orderParams.timeInForce = "GTC";

        result = await binanceRequest(baseUrl, creds.api_key, creds.api_secret, "POST", "/fapi/v1/order", orderParams);
        break;
      }

      case "cancel_order": {
        if (!actionParams.symbol || !actionParams.orderId) {
          return jsonResponse({ error: "Parâmetros obrigatórios ausentes para cancel_order (symbol, orderId)." }, 400);
        }
        result = await binanceRequest(baseUrl, creds.api_key, creds.api_secret, "DELETE", "/fapi/v1/order", {
          symbol: String(actionParams.symbol),
          orderId: String(actionParams.orderId),
        });
        break;
      }

      case "cancel_all": {
        if (actionParams.symbol) {
          result = await binanceRequest(
            baseUrl,
            creds.api_key,
            creds.api_secret,
            "DELETE",
            "/fapi/v1/allOpenOrders",
            { symbol: String(actionParams.symbol) }
          );
        } else {
          const positions = await binanceRequest(baseUrl, creds.api_key, creds.api_secret, "GET", "/fapi/v2/positionRisk");
          const activePositions = positions.filter((p: any) => parseFloat(p.positionAmt) !== 0);
          const closeResults = [];

          for (const pos of activePositions) {
            const amt = parseFloat(pos.positionAmt);
            const closeSide = amt > 0 ? "SELL" : "BUY";
            try {
              const closeResult = await binanceRequest(baseUrl, creds.api_key, creds.api_secret, "POST", "/fapi/v1/order", {
                symbol: pos.symbol,
                side: closeSide,
                type: "MARKET",
                quantity: Math.abs(amt).toString(),
                reduceOnly: "true",
              });
              closeResults.push(closeResult);
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Erro ao fechar posição";
              closeResults.push({ error: msg, symbol: pos.symbol });
            }
          }

          result = { closed: closeResults.length, details: closeResults };
        }
        break;
      }

      case "set_leverage": {
        if (!actionParams.symbol || actionParams.leverage === undefined || actionParams.leverage === null) {
          return jsonResponse({ error: "Parâmetros obrigatórios ausentes para set_leverage (symbol, leverage)." }, 400);
        }
        result = await binanceRequest(baseUrl, creds.api_key, creds.api_secret, "POST", "/fapi/v1/leverage", {
          symbol: String(actionParams.symbol),
          leverage: Number(actionParams.leverage).toString(),
        });
        break;
      }

      default:
        return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400);
    }

    console.log(`[binance-proxy] Action ${action} completed successfully`);
    return jsonResponse(result);
  } catch (error) {
    if (error instanceof BinanceApiError) {
      const friendlyMessage = formatBinanceError(error.code, error.message, currentIsTestnet);
      console.error("[binance-proxy] Binance error:", friendlyMessage);
      return jsonResponse({ error: friendlyMessage, binance_code: error.code }, 400);
    }

    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[binance-proxy] Error:", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
