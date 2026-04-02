
UPDATE auto_management_history
SET signal_strength_pct = ROUND(
  CASE 
    WHEN COALESCE((full_result->'technical_indicators'->'confluence'->>'buy_score')::numeric, 0) + 
         COALESCE((full_result->'technical_indicators'->'confluence'->>'sell_score')::numeric, 0) > 0
    THEN (
      ABS(
        COALESCE((full_result->'technical_indicators'->'confluence'->>'buy_score')::numeric, 0) - 
        COALESCE((full_result->'technical_indicators'->'confluence'->>'sell_score')::numeric, 0)
      ) / (
        COALESCE((full_result->'technical_indicators'->'confluence'->>'buy_score')::numeric, 0) + 
        COALESCE((full_result->'technical_indicators'->'confluence'->>'sell_score')::numeric, 0)
      ) * 100
    )
    ELSE 0
  END
)
WHERE deleted_at IS NULL
  AND signal NOT IN ('NEUTRO', 'NEUTRAL')
  AND full_result->'technical_indicators'->'confluence' IS NOT NULL;
