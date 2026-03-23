-- =============================================
-- FIX: Convert ALL RESTRICTIVE policies to PERMISSIVE
-- =============================================

-- ============ broker_credentials ============
DROP POLICY IF EXISTS "Users can delete own credentials" ON public.broker_credentials;
DROP POLICY IF EXISTS "Users can insert own credentials" ON public.broker_credentials;
DROP POLICY IF EXISTS "Users can update own credentials" ON public.broker_credentials;
DROP POLICY IF EXISTS "Users can view own credentials" ON public.broker_credentials;

CREATE POLICY "Users can view own credentials" ON public.broker_credentials
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials" ON public.broker_credentials
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials" ON public.broker_credentials
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials" ON public.broker_credentials
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ autopilot_settings ============
DROP POLICY IF EXISTS "Users can insert own settings" ON public.autopilot_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.autopilot_settings;
DROP POLICY IF EXISTS "Users can view own settings" ON public.autopilot_settings;

CREATE POLICY "Users can view own settings" ON public.autopilot_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON public.autopilot_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON public.autopilot_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ analysis_history ============
DROP POLICY IF EXISTS "Users can delete own history" ON public.analysis_history;
DROP POLICY IF EXISTS "Users can insert own history" ON public.analysis_history;
DROP POLICY IF EXISTS "Users can view own history" ON public.analysis_history;

CREATE POLICY "Users can view own history" ON public.analysis_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON public.analysis_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own history" ON public.analysis_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ profiles ============
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow insert for own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ user_roles ============
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);