
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Table: auto_analysis_configs
CREATE TABLE public.auto_analysis_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  analysis_period_minutes INTEGER NOT NULL DEFAULT 45,
  is_active BOOLEAN NOT NULL DEFAULT true,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: auto_analysis_history
CREATE TABLE public.auto_analysis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.auto_analysis_configs(id) ON DELETE CASCADE,
  asset TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  signal_strength_pct NUMERIC,
  final_confidence_pct NUMERIC,
  entry_price NUMERIC,
  stop_loss NUMERIC,
  take_profit_1 NUMERIC,
  take_profit_2 NUMERIC,
  take_profit_3 NUMERIC,
  signal TEXT,
  trend TEXT,
  risk_reward_ratio TEXT,
  executive_summary TEXT,
  full_result JSONB,
  final_result_candle JSONB,
  status TEXT NOT NULL DEFAULT 'PENDING',
  tp1_hit_time TIMESTAMPTZ,
  tp2_hit_time TIMESTAMPTZ,
  tp3_hit_time TIMESTAMPTZ,
  loss_hit_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for status instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_auto_analysis_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status NOT IN ('PENDING', 'WIN', 'LOSS') THEN
    RAISE EXCEPTION 'Invalid status value: %. Allowed: PENDING, WIN, LOSS', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_auto_analysis_status
  BEFORE INSERT OR UPDATE ON public.auto_analysis_history
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_auto_analysis_status();

-- updated_at trigger for configs
CREATE TRIGGER trg_auto_analysis_configs_updated_at
  BEFORE UPDATE ON public.auto_analysis_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.auto_analysis_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_analysis_history ENABLE ROW LEVEL SECURITY;

-- RLS for auto_analysis_configs: admin only
CREATE POLICY "Admins can select configs"
  ON public.auto_analysis_configs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert configs"
  ON public.auto_analysis_configs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update configs"
  ON public.auto_analysis_configs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete configs"
  ON public.auto_analysis_configs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS for auto_analysis_history: admin can read/update, service_role bypasses RLS
CREATE POLICY "Admins can select history"
  ON public.auto_analysis_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update history"
  ON public.auto_analysis_history FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert history"
  ON public.auto_analysis_history FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete history"
  ON public.auto_analysis_history FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
