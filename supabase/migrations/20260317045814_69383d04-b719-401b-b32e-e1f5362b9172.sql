
-- Trade Positions: State machine for managing partial take profits and trailing stops
CREATE TABLE public.trade_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  analysis_id UUID REFERENCES public.analysis_history(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('LONG', 'SHORT')),
  trade_state TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (trade_state IN ('PENDING', 'ACTIVE', 'TP1_HIT', 'TP2_HIT', 'CLOSED')),
  
  -- Position tracking (DCA-aware)
  original_size NUMERIC NOT NULL,
  total_position_size NUMERIC NOT NULL,
  current_avg_price NUMERIC NOT NULL,
  true_breakeven_price NUMERIC NOT NULL,
  accumulated_fees NUMERIC NOT NULL DEFAULT 0,
  partial_size NUMERIC NOT NULL,
  
  -- Price levels
  entry_price NUMERIC NOT NULL,
  stop_loss_original NUMERIC NOT NULL,
  stop_loss_current NUMERIC NOT NULL,
  take_profit_1 NUMERIC NOT NULL,
  take_profit_2 NUMERIC,
  take_profit_3 NUMERIC,
  tp_type TEXT NOT NULL DEFAULT 'FIXED_PRICE' CHECK (tp_type IN ('FIXED_PRICE', 'PERCENTAGE')),
  
  -- Leverage & risk
  leverage INTEGER NOT NULL DEFAULT 1,
  risk_pct NUMERIC NOT NULL DEFAULT 2,
  
  -- Execution tracking
  tp1_filled_at TIMESTAMPTZ,
  tp2_filled_at TIMESTAMPTZ,
  tp3_filled_at TIMESTAMPTZ,
  sl_filled_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  close_reason TEXT,
  
  -- Binance order IDs
  entry_order_id TEXT,
  sl_order_id TEXT,
  tp1_order_id TEXT,
  tp2_order_id TEXT,
  tp3_order_id TEXT,
  
  -- P&L
  realized_pnl NUMERIC DEFAULT 0,
  unrealized_pnl NUMERIC DEFAULT 0,
  
  -- DCA tracking
  dca_count INTEGER NOT NULL DEFAULT 1,
  dca_history JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.trade_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trade_positions"
  ON public.trade_positions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trade_positions"
  ON public.trade_positions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trade_positions"
  ON public.trade_positions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER update_trade_positions_updated_at
  BEFORE UPDATE ON public.trade_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
