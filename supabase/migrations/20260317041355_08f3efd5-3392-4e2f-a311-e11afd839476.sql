-- Add soft-delete column to auto_analysis_history
ALTER TABLE public.auto_analysis_history
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Update RLS policies to exclude soft-deleted records
DROP POLICY IF EXISTS "Admins can select history" ON public.auto_analysis_history;
CREATE POLICY "Admins can select history"
  ON public.auto_analysis_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Admins can update history" ON public.auto_analysis_history;
CREATE POLICY "Admins can update history"
  ON public.auto_analysis_history FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));