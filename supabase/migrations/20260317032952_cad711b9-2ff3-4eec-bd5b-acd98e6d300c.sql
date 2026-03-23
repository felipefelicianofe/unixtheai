
ALTER TABLE public.refinement_log 
  ADD COLUMN IF NOT EXISTS loss_avoidance_rate numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS missed_opportunity_rate numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS effective_threshold numeric DEFAULT NULL;
