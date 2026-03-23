
ALTER TABLE public.auto_analysis_configs
  ADD COLUMN IF NOT EXISTS leverage integer NOT NULL DEFAULT 1;
