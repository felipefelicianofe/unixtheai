
-- ============================================================
-- 1. auto_management_configs (clone of auto_analysis_configs)
-- ============================================================
CREATE TABLE public.auto_management_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL,
  asset text NOT NULL,
  timeframe text NOT NULL,
  analysis_period_minutes integer NOT NULL DEFAULT 45,
  leverage integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_management_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select management configs" ON public.auto_management_configs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert management configs" ON public.auto_management_configs FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update management configs" ON public.auto_management_configs FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete management configs" ON public.auto_management_configs FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 2. auto_management_history (clone of auto_analysis_history)
-- ============================================================
CREATE TABLE public.auto_management_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id uuid NOT NULL REFERENCES public.auto_management_configs(id) ON DELETE CASCADE,
  asset text NOT NULL,
  timeframe text NOT NULL,
  signal text,
  signal_strength_pct numeric,
  final_confidence_pct numeric,
  entry_price numeric,
  stop_loss numeric,
  take_profit_1 numeric,
  take_profit_2 numeric,
  take_profit_3 numeric,
  trend text,
  risk_reward_ratio text,
  executive_summary text,
  full_result jsonb,
  status text NOT NULL DEFAULT 'PENDING',
  current_price numeric,
  current_price_time timestamp with time zone,
  distance_tp1_pct numeric,
  distance_tp2_pct numeric,
  distance_tp3_pct numeric,
  distance_sl_pct numeric,
  virtual_pnl_pct numeric,
  last_verified_at timestamp with time zone,
  tp1_hit_time timestamp with time zone,
  tp2_hit_time timestamp with time zone,
  tp3_hit_time timestamp with time zone,
  loss_hit_time timestamp with time zone,
  final_result_candle jsonb,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_management_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select management history" ON public.auto_management_history FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert management history" ON public.auto_management_history FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update management history" ON public.auto_management_history FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete management history" ON public.auto_management_history FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Status validation trigger (same as auto_analysis_history)
CREATE OR REPLACE FUNCTION public.validate_auto_management_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('PENDING', 'WIN', 'WIN_TP1', 'WIN_TP2', 'WIN_TP3', 'LOSS', 'NEUTRAL') THEN
    RAISE EXCEPTION 'Invalid status value: %. Allowed: PENDING, WIN, WIN_TP1, WIN_TP2, WIN_TP3, LOSS, NEUTRAL', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_management_status_trigger
  BEFORE INSERT OR UPDATE ON public.auto_management_history
  FOR EACH ROW EXECUTE FUNCTION public.validate_auto_management_status();

-- ============================================================
-- 3. management_indicator_performance (clone of indicator_performance)
-- ============================================================
CREATE TABLE public.management_indicator_performance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id uuid NOT NULL REFERENCES public.auto_management_history(id) ON DELETE CASCADE,
  asset text NOT NULL,
  timeframe text NOT NULL,
  indicator_name text NOT NULL,
  direction_suggested text NOT NULL,
  weight_used numeric NOT NULL DEFAULT 1.0,
  was_correct boolean,
  actual_result text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.management_indicator_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage management_indicator_performance" ON public.management_indicator_performance FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 4. management_refinement_weights (clone of refinement_weights)
-- ============================================================
CREATE TABLE public.management_refinement_weights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset text NOT NULL,
  timeframe text NOT NULL,
  indicator_name text NOT NULL,
  original_weight numeric NOT NULL DEFAULT 1.0,
  calibrated_weight numeric NOT NULL DEFAULT 1.0,
  win_rate numeric DEFAULT 0,
  sample_count integer DEFAULT 0,
  trend text DEFAULT 'STABLE',
  last_calibrated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.management_refinement_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage management_refinement_weights" ON public.management_refinement_weights FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 5. management_refinement_log (clone of refinement_log)
-- ============================================================
CREATE TABLE public.management_refinement_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset text NOT NULL,
  timeframe text NOT NULL,
  analysis_count integer DEFAULT 0,
  indicators_adjusted integer DEFAULT 0,
  overall_wr_before numeric,
  overall_wr_after numeric,
  projected_wr_new_weights numeric,
  backtest_signal_changes integer DEFAULT 0,
  backtest_details jsonb,
  loss_avoidance_rate numeric,
  missed_opportunity_rate numeric,
  effective_threshold numeric,
  adjustments_json jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.management_refinement_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage management_refinement_log" ON public.management_refinement_log FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
