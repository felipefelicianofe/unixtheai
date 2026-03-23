ALTER TABLE public.refinement_log 
  ADD COLUMN IF NOT EXISTS projected_wr_new_weights numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS backtest_signal_changes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backtest_details jsonb DEFAULT NULL;