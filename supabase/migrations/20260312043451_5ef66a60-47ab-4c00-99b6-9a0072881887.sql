-- Add unique constraint on user_id to prevent duplicate credentials
-- First clean up any potential duplicates
DELETE FROM public.broker_credentials a
USING public.broker_credentials b
WHERE a.id < b.id AND a.user_id = b.user_id;

-- Add unique constraint
ALTER TABLE public.broker_credentials ADD CONSTRAINT broker_credentials_user_id_unique UNIQUE (user_id);

-- Also add unique constraint on autopilot_settings to prevent duplicates
DELETE FROM public.autopilot_settings a
USING public.autopilot_settings b
WHERE a.id < b.id AND a.user_id = b.user_id;

ALTER TABLE public.autopilot_settings ADD CONSTRAINT autopilot_settings_user_id_unique UNIQUE (user_id);