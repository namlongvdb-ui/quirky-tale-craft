
-- Drop the new views (caused security_definer_view linter errors)
DROP VIEW IF EXISTS public.directory_profiles;
DROP VIEW IF EXISTS public.directory_user_roles;
DROP VIEW IF EXISTS public.signature_public_keys;

-- ============ Directory functions (SECURITY DEFINER, authenticated only) ============

CREATE OR REPLACE FUNCTION public.get_directory_profiles()
RETURNS TABLE (user_id uuid, full_name text, username text, assigned_area text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, full_name, username, assigned_area FROM public.profiles;
$$;
REVOKE EXECUTE ON FUNCTION public.get_directory_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_directory_profiles() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_directory_user_roles()
RETURNS TABLE (user_id uuid, role public.app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, role FROM public.user_roles;
$$;
REVOKE EXECUTE ON FUNCTION public.get_directory_user_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_directory_user_roles() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_signature_public_keys()
RETURNS TABLE (user_id uuid, public_key text, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, public_key, is_active FROM public.digital_signatures;
$$;
REVOKE EXECUTE ON FUNCTION public.get_signature_public_keys() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_signature_public_keys() TO authenticated;

-- ============ Revoke anon SELECT on business tables (fix GraphQL exposure warnings) ============
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.user_roles FROM anon;
REVOKE SELECT ON public.digital_signatures FROM anon;
REVOKE SELECT ON public.notifications FROM anon;
REVOKE SELECT ON public.pending_vouchers FROM anon;
REVOKE SELECT ON public.voucher_signatures FROM anon;
