Por favor, atualize o Edge Function `analyze-asset` (arquivo `supabase/functions/analyze-asset/index.ts`) com as seguintes alterações nos mapas de símbolos para suportar corretamente os ativos enviados pela plataforma do Automotor de Análises:

1. Modifique o `COINGECKO_MAP` (perto da linha 1625) para incluir as versões sem barra (ex: "BTCUSDT") e também o suporte para Ouro (XAU/USD e XAUUSD):

```typescript
const COINGECKO_MAP: Record<string, string> = {
  "BTC/USDT": "bitcoin", "BTC/USD": "bitcoin", "BTC": "bitcoin", "BTCUSDT": "bitcoin",
  "ETH/USDT": "ethereum", "ETH/USD": "ethereum", "ETH": "ethereum", "ETHUSDT": "ethereum",
  "SOL/USDT": "solana", "SOL/USD": "solana", "SOL": "solana", "SOLUSDT": "solana",
  "ADA/USDT": "cardano", "ADA/USD": "cardano", "ADA": "cardano", "ADAUSDT": "cardano",
  "DOT/USDT": "polkadot", "DOT/USD": "polkadot", "DOT": "polkadot", "DOTUSDT": "polkadot",
  "AVAX/USDT": "avalanche-2", "AVAX/USD": "avalanche-2", "AVAX": "avalanche-2", "AVAXUSDT": "avalanche-2",
  "DOGE/USDT": "dogecoin", "DOGE/USD": "dogecoin", "DOGE": "dogecoin", "DOGEUSDT": "dogecoin",
  "XRP/USDT": "ripple", "XRP/USD": "ripple", "XRP": "ripple", "XRPUSDT": "ripple",
  "LINK/USDT": "chainlink", "LINK/USD": "chainlink", "LINK": "chainlink", "LINKUSDT": "chainlink",
  "MATIC/USDT": "matic-network", "MATIC/USD": "matic-network", "MATIC": "matic-network", "MATICUSDT": "matic-network",
  "BNB/USDT": "binancecoin", "BNB/USD": "binancecoin", "BNB": "binancecoin", "BNBUSDT": "binancecoin",
  "ATOM/USDT": "cosmos", "NEAR/USDT": "near", "ARB/USDT": "arbitrum",
  "OP/USDT": "optimism", "SUI/USDT": "sui", "APT/USDT": "aptos",
  "UNI/USDT": "uniswap", "AAVE/USDT": "aave", "LTC/USDT": "litecoin",
  "ATOMUSDT": "cosmos", "NEARUSDT": "near", "ARBUSDT": "arbitrum",
  "OPUSDT": "optimism", "SUIUSDT": "sui", "APTUSDT": "aptos",
  "UNIUSDT": "uniswap", "AAVEUSDT": "aave", "LTCUSDT": "litecoin",
  "XAU/USD": "pax-gold", "XAUUSD": "pax-gold", "XAU": "pax-gold", "GOLD": "pax-gold"
};
```

2. Modifique o `BINANCE_SYMBOL_MAP` (logo abaixo) para também reconhecer as versões sem barra e mapear o Ouro para o par PAXGUSDT (que segue fielmente a onça troy do Ouro com excelente liquidez):

```typescript
const BINANCE_SYMBOL_MAP: Record<string, string> = {
  "BTC/USDT": "BTCUSDT", "BTC/USD": "BTCUSDT", "BTC": "BTCUSDT", "BTCUSDT": "BTCUSDT",
  "ETH/USDT": "ETHUSDT", "ETH/USD": "ETHUSDT", "ETH": "ETHUSDT", "ETHUSDT": "ETHUSDT",
  "SOL/USDT": "SOLUSDT", "SOL/USD": "SOLUSDT", "SOL": "SOLUSDT", "SOLUSDT": "SOLUSDT",
  "ADA/USDT": "ADAUSDT", "ADA/USD": "ADAUSDT", "ADA": "ADAUSDT", "ADAUSDT": "ADAUSDT",
  "DOT/USDT": "DOTUSDT", "DOT/USD": "DOTUSDT", "DOT": "DOTUSDT", "DOTUSDT": "DOTUSDT",
  "AVAX/USDT": "AVAXUSDT", "AVAX/USD": "AVAXUSDT", "AVAX": "AVAXUSDT", "AVAXUSDT": "AVAXUSDT",
  "DOGE/USDT": "DOGEUSDT", "DOGE/USD": "DOGEUSDT", "DOGE": "DOGEUSDT", "DOGEUSDT": "DOGEUSDT",
  "XRP/USDT": "XRPUSDT", "XRP/USD": "XRPUSDT", "XRP": "XRPUSDT", "XRPUSDT": "XRPUSDT",
  "LINK/USDT": "LINKUSDT", "LINK/USD": "LINKUSDT", "LINK": "LINKUSDT", "LINKUSDT": "LINKUSDT",
  "MATIC/USDT": "MATICUSDT", "MATIC/USD": "MATICUSDT", "MATIC": "MATICUSDT", "MATICUSDT": "MATICUSDT",
  "BNB/USDT": "BNBUSDT", "BNB/USD": "BNBUSDT", "BNB": "BNBUSDT", "BNBUSDT": "BNBUSDT",
  "ATOM/USDT": "ATOMUSDT", "NEAR/USDT": "NEARUSDT", "ARB/USDT": "ARBUSDT",
  "OP/USDT": "OPUSDT", "SUI/USDT": "SUIUSDT", "APT/USDT": "APTUSDT",
  "UNI/USDT": "UNIUSDT", "AAVE/USDT": "AAVEUSDT", "LTC/USDT": "LTCUSDT",
  "ATOMUSDT": "ATOMUSDT", "NEARUSDT": "NEARUSDT", "ARBUSDT": "ARBUSDT",
  "OPUSDT": "OPUSDT", "SUIUSDT": "SUIUSDT", "APTUSDT": "APTUSDT",
  "UNIUSDT": "UNIUSDT", "AAVEUSDT": "AAVEUSDT", "LTCUSDT": "LTCUSDT",
  "XAU/USD": "PAXGUSDT", "XAUUSD": "PAXGUSDT", "XAU": "PAXGUSDT", "GOLD": "PAXGUSDT"
};
```

Essas alterações vão evitar que ativos enviados em formato unificado (ex: BTCUSDT) falhem em buscar o preço real da API da Binance, acabando com as "alucinações" de preço da IA, e garantindo que o Ouro receba dados reais sem falhas. Por favor, implante essa alteração para atualizar o ambiente do backend principal.
