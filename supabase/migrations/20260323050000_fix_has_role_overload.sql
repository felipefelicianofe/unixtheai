-- FIX: Remove duplicate has_role overload and fix text/enum comparison.
-- Root cause: migration 20260322 created has_role(app_role, uuid) alongside
-- the canonical has_role(uuid, app_role), causing ambiguity.
-- Additionally, user_roles.role is text in production, not app_role enum,
-- so we cast both sides to text for safe comparison.

-- 1. Drop the inverted overload (role first, user_id second)
DROP FUNCTION IF EXISTS public.has_role(app_role, uuid);

-- 2. Replace canonical version with text-safe comparison
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role::text
  )
$$;
