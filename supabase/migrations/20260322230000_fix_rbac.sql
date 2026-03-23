-- ARQUIVO: fix-rbac.sql
-- OBJETIVO: Curar a raiz do sistema de RBAC legado (Auth Loop Bug).
-- COMANDO: Copie integralmente o código abaixo e cole no SQL Editor do seu Supabase. Clique em "Run".

-- 1. Criação de Tipo Enum (Seguro caso já exista)
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Garantir que a tabela existe perfeitamente
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'user',
    UNIQUE (user_id, role)
);

-- 3. Ativar e strictizar as políticas RLS 
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role" 
ON public.user_roles
FOR SELECT 
USING (auth.uid() = user_id);

-- 4. Função Crucial: Bypass de RLS via SECURITY DEFINER (para checkAdmin do AuthContext)
CREATE OR REPLACE FUNCTION public.has_role(_role app_role, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- 5. Função Dinâmica de Promoção para Novos Arquitetos Mestre
-- Todo novo usuário será User. Mas se for o PRIMEIRO do banco, vira Admin.
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count integer;
BEGIN
  SELECT count(*) into user_count FROM auth.users;
  
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user');
  END IF;
  
  RETURN new;
END;
$$;

-- Refazendo o Trigger do Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_role();

-- 6. VACINA DE ESTADO EXISTENTE: Se você já tem sua conta travada no banco, isso forçará 
-- você como Admin imediatamente, destravando a porta sem danificar a integridade.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
ON CONFLICT DO NOTHING;
