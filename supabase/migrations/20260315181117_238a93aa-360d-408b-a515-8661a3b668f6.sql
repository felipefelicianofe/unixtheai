
-- Add new tracking columns to auto_analysis_history
ALTER TABLE public.auto_analysis_history
  ADD COLUMN IF NOT EXISTS current_price numeric,
  ADD COLUMN IF NOT EXISTS current_price_time timestamptz,
  ADD COLUMN IF NOT EXISTS distance_tp1_pct numeric,
  ADD COLUMN IF NOT EXISTS distance_tp2_pct numeric,
  ADD COLUMN IF NOT EXISTS distance_tp3_pct numeric,
  ADD COLUMN IF NOT EXISTS distance_sl_pct numeric,
  ADD COLUMN IF NOT EXISTS virtual_pnl_pct numeric,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

-- Update the status validation trigger to accept granular win statuses
CREATE OR REPLACE FUNCTION public.validate_auto_analysis_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('PENDING', 'WIN', 'WIN_TP1', 'WIN_TP2', 'WIN_TP3', 'LOSS') THEN
    RAISE EXCEPTION 'Invalid status value: %. Allowed: PENDING, WIN, WIN_TP1, WIN_TP2, WIN_TP3, LOSS', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;
