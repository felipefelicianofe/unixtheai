-- Add policy to allow admins to view deleted records specifically
CREATE POLICY "Admins can select deleted history"
  ON public.auto_analysis_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND deleted_at IS NOT NULL);