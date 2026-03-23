-- Simplify: let admins see all records, filter deleted in app layer
DROP POLICY IF EXISTS "Admins can select history" ON public.auto_analysis_history;
DROP POLICY IF EXISTS "Admins can select deleted history" ON public.auto_analysis_history;
CREATE POLICY "Admins can select history"
  ON public.auto_analysis_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));