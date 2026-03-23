-- =========================================================================================
-- SYSTEM KERNEL UPGRADE: AUTONOMOUS 24/7 TRADING ENGINE VIA PG_CRON
-- =========================================================================================

-- 1. Habilitar extensões vitais para o Motor Autônomo
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Criar a Tabela de Heartbeat (Monitor de Pulso)
CREATE TABLE IF NOT EXISTS public.system_heartbeats (
    caller_name TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'OK',
    last_pulse_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ativar RLS
ALTER TABLE public.system_heartbeats ENABLE ROW LEVEL SECURITY;

-- 2.5 Atualizar a tabela de configurações para aceitar os Ativos Alvo dinamicamente
ALTER TABLE public.autopilot_settings ADD COLUMN IF NOT EXISTS target_assets JSONB DEFAULT '["BTCUSDT", "ETHUSDT", "SOLUSDT"]'::jsonb;

-- Policy: Leitura pública (para o frontend visualizar se o motor está vivo)
DROP POLICY IF EXISTS "Leitura pública do Heartbeat" ON public.system_heartbeats;
CREATE POLICY "Leitura pública do Heartbeat" 
    ON public.system_heartbeats 
    FOR SELECT 
    USING (true);

-- 3. Agendamento Contínuo (CRONJOBS)
-- Substitua 'SUA_SERVICE_ROLE_KEY' pela sua Service Role Key real encontrada no Dashboard 
-- Substitua 'lqjordqablukrlyzddur' pelo seu project ID se diferir

-- A. Agendamento do Auto-Refine (Gerenciador de ordens ativas - A cada 1 minuto)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'loop_auto_management';
SELECT cron.schedule(
    'loop_auto_management',
    '* * * * *', -- A cada 1 minuto
    $$
    SELECT net.http_post(
        url:='https://lqjordqablukrlyzddur.supabase.co/functions/v1/run-auto-management',
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer SUA_SERVICE_ROLE_KEY'
        )
    );
    $$
);

-- B. Agendamento do Auto-Trade Engine (Invasão e Execução de Setups Ótimos - A cada 5 minutos)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'loop_autotrade_engine';
SELECT cron.schedule(
    'loop_autotrade_engine',
    '*/5 * * * *', -- A cada 5 minutos
    $$
    SELECT net.http_post(
        url:='https://lqjordqablukrlyzddur.supabase.co/functions/v1/autotrade-engine',
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer SUA_SERVICE_ROLE_KEY'
        ),
        body:=jsonb_build_object(
            'assets', '["BTCUSDT", "ETHUSDT", "SOLUSDT"]',
            'timeframe', '1h'
        )
    );
    $$
);

-- C. Agendamento do Analisador Massivo (A cada 5 minutos alternado)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'loop_auto_analyses';
SELECT cron.schedule(
    'loop_auto_analyses',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url:='https://lqjordqablukrlyzddur.supabase.co/functions/v1/run-auto-analyses',
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer SUA_SERVICE_ROLE_KEY'
        )
    );
    $$
);
