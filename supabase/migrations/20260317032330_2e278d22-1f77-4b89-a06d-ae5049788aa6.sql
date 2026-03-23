
-- 1. Update validation trigger to accept NEUTRAL status
CREATE OR REPLACE FUNCTION public.validate_auto_analysis_status()
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

-- 2. Fix existing NEUTRO records: set status to NEUTRAL and clear TP/SL
UPDATE public.auto_analysis_history
SET status = 'NEUTRAL',
    entry_price = NULL,
    stop_loss = NULL,
    take_profit_1 = NULL,
    take_profit_2 = NULL,
    take_profit_3 = NULL,
    current_price = NULL,
    distance_tp1_pct = NULL,
    distance_tp2_pct = NULL,
    distance_tp3_pct = NULL,
    distance_sl_pct = NULL,
    virtual_pnl_pct = NULL
WHERE signal IN ('NEUTRO', 'NEUTRAL')
  AND status = 'PENDING';
