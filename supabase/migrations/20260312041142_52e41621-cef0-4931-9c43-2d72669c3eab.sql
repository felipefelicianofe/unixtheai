
-- Table: broker_credentials (stores encrypted API keys per user)
CREATE TABLE public.broker_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  broker TEXT NOT NULL DEFAULT 'binance_futures',
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.broker_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credentials" ON public.broker_credentials
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials" ON public.broker_credentials
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials" ON public.broker_credentials
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials" ON public.broker_credentials
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Table: autopilot_settings (persists autopilot state across sessions)
CREATE TABLE public.autopilot_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  risk_pct NUMERIC NOT NULL DEFAULT 2,
  max_leverage INTEGER NOT NULL DEFAULT 10,
  profit_goal NUMERIC NOT NULL DEFAULT 200,
  max_loss NUMERIC NOT NULL DEFAULT 100,
  deactivation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.autopilot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.autopilot_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON public.autopilot_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON public.autopilot_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_broker_credentials_updated_at
  BEFORE UPDATE ON public.broker_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_autopilot_settings_updated_at
  BEFORE UPDATE ON public.autopilot_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
