
-- Table: indicator_performance — granular per-indicator results from each analysis
CREATE TABLE public.indicator_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.auto_analysis_history(id) ON DELETE CASCADE,
  asset text NOT NULL,
  timeframe text NOT NULL,
  indicator_name text NOT NULL,
  direction_suggested text NOT NULL, -- BUY, SELL, NEUTRAL
  weight_used numeric NOT NULL DEFAULT 1.0,
  actual_result text, -- WIN, LOSS, PENDING
  was_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by asset/timeframe/indicator
CREATE INDEX idx_indicator_perf_asset_tf ON public.indicator_performance(asset, timeframe, indicator_name);
CREATE INDEX idx_indicator_perf_analysis ON public.indicator_performance(analysis_id);

-- Table: refinement_weights — calibrated weights per asset/timeframe
CREATE TABLE public.refinement_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  timeframe text NOT NULL,
  indicator_name text NOT NULL,
  original_weight numeric NOT NULL DEFAULT 1.0,
  calibrated_weight numeric NOT NULL DEFAULT 1.0,
  win_rate numeric DEFAULT 0,
  sample_count integer DEFAULT 0,
  trend text DEFAULT 'STABLE', -- IMPROVING, DEGRADING, STABLE
  last_calibrated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(asset, timeframe, indicator_name)
);

CREATE INDEX idx_refinement_weights_lookup ON public.refinement_weights(asset, timeframe);

-- Table: refinement_log — history of calibration runs
CREATE TABLE public.refinement_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL,
  timeframe text NOT NULL,
  overall_wr_before numeric,
  overall_wr_after numeric,
  indicators_adjusted integer DEFAULT 0,
  adjustments_json jsonb,
  analysis_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refinement_log_asset_tf ON public.refinement_log(asset, timeframe);

-- RLS: Admin-only access for all refinement tables
ALTER TABLE public.indicator_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refinement_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refinement_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage indicator_performance" ON public.indicator_performance
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage refinement_weights" ON public.refinement_weights
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage refinement_log" ON public.refinement_log
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
