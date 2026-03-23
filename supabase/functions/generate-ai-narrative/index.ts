import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisData, sections } = await req.json();
    // sections: array of "executive_summary" | "wegd" | "master_audit"

    if (!analysisData || !sections || sections.length === 0) {
      return new Response(JSON.stringify({ error: "analysisData and sections are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) {
      return new Response(JSON.stringify({ error: "GOOGLE_AI_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const header = analysisData.header || {};
    const rm = analysisData.risk_management || {};
    const ti = analysisData.technical_indicators || {};
    const smc = analysisData.smc_analysis || {};
    const quant = analysisData.quantitative || {};
    const master = analysisData._master || {};

    const sectionsRequested = sections.join(", ");

    const prompt = `# KATON AI — Geração de Narrativa On-Demand

## CONTEXTO DA ANÁLISE
- Ativo: ${header.asset} | Timeframe: ${header.timeframe}
- Sinal: ${header.signal} | Confiança: ${header.final_confidence_pct}% | Força: ${header.signal_strength_pct}%
- Tendência: ${header.trend}
- Entry: ${rm.entry_price} | SL: ${rm.stop_loss} | TP1: ${rm.take_profit_1} | TP2: ${rm.take_profit_2} | TP3: ${rm.take_profit_3}
- RSI: ${ti.rsi?.value} | MACD Hist: ${ti.macd?.histogram} | ADX: ${ti.adx?.value}
- EMA20: ${ti.ema_20} | EMA50: ${ti.ema_50} | EMA200: ${ti.ema_200}
- Bollinger: ${ti.bollinger?.upper}/${ti.bollinger?.middle}/${ti.bollinger?.lower}
- Stoch: K=${ti.stochastic?.k} D=${ti.stochastic?.d} | MFI: ${ti.mfi} | CCI: ${ti.cci}
- Buy Signals: ${ti.buy_signals} | Sell Signals: ${ti.sell_signals} | Neutral: ${ti.neutral_signals}
- SMC Bias: ${smc.bias} | BOS: ${smc.break_of_structure}
- Monte Carlo: ${quant.monte_carlo_bull_pct}% bull / ${quant.monte_carlo_bear_pct}% bear
- Sharpe: ${quant.sharpe_ratio} | Sortino: ${quant.sortino_ratio} | MaxDD: ${quant.max_drawdown_pct}%
- Win Rate: ${quant.win_rate_historical}%
- HTF Bias: ${analysisData._htf_bias || "N/A"}
- Ichimoku: ${ti.ichimoku?.signal || "N/A"}
- Regime: ${ti.regime?.regime || "N/A"}
${analysisData._fear_greed ? `- Fear & Greed: ${analysisData._fear_greed.value}/100 (${analysisData._fear_greed.classification})` : ""}
${analysisData._funding_rate !== null && analysisData._funding_rate !== undefined ? `- Funding Rate: ${(analysisData._funding_rate * 100).toFixed(4)}%` : ""}
${analysisData._volume_delta ? `- Volume Delta: ${analysisData._volume_delta.pressure} (Ratio: ${analysisData._volume_delta.ratio})` : ""}
${master.verdict ? `- Master Agent: ${master.verdict} (Quality: ${master.quality_score})` : ""}

## SEÇÕES SOLICITADAS: ${sectionsRequested}

Gere APENAS as seções solicitadas em JSON. Formato:
{
  ${sections.includes("executive_summary") ? `"executive_summary": "Texto detalhado explicando a lógica do sinal ${header.signal}, mencionando indicadores-chave, confluência e contexto macro. 3-5 parágrafos.",
  "warning": "Riscos mapeados e cenários adversos.",
  "best_hours": ["HH:MM-HH:MM UTC"],` : ""}
  ${sections.includes("wegd") ? `"wegd_analysis": {
    "wyckoff_phase": "Fase de Wyckoff interpretada com base nos indicadores",
    "elliott_wave": "Onda de Elliott interpretada",
    "gann_angle": "Ângulo de Gann interpretado",
    "dow_theory": "Teoria de Dow interpretada",
    "confluence_score": "ALTA|MODERADA|BAIXA com justificativa"
  },` : ""}
  ${sections.includes("master_audit") ? `"master_narrative": "Auditoria detalhada do Master Agent explicando cada verificação realizada e o veredito final."` : ""}
}

REGRAS:
1. Baseie-se EXCLUSIVAMENTE nos dados numéricos fornecidos
2. NÃO invente valores ou indicadores
3. Interprete Wyckoff/Elliott/Gann/Dow com base nos indicadores calculados
4. Retorne APENAS JSON válido (sem markdown)`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um analista quantitativo institucional. Gere narrativas precisas baseadas em dados técnicos." },
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google AI error:", response.status, errText);
      return new Response(JSON.stringify({ error: `AI error: ${response.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1].trim());
        } else {
          const objectMatch = content.match(/\{[\s\S]*\}/);
          if (objectMatch) {
            parsed = JSON.parse(objectMatch[0]);
          } else {
            throw new Error("No JSON found");
          }
        }
      } catch {
        return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: content.substring(0, 500) }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-ai-narrative error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
