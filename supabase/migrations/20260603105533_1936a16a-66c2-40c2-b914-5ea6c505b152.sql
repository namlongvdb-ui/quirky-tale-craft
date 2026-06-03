
-- =========================================
-- 1) PROFILES: restrict SELECT to self + admin
-- =========================================
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Public directory exposing only non-sensitive fields (no email)
CREATE OR REPLACE VIEW public.directory_profiles
WITH (security_invoker = false) AS
SELECT user_id, full_name, username, assigned_area
FROM public.profiles;

GRANT SELECT ON public.directory_profiles TO authenticated;

-- =========================================
-- 2) USER_ROLES: restrict SELECT to self + admin
-- =========================================
DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Public directory of user_id -> role for workflow UI
CREATE OR REPLACE VIEW public.directory_user_roles
WITH (security_invoker = false) AS
SELECT user_id, role
FROM public.user_roles;

GRANT SELECT ON public.directory_user_roles TO authenticated;

-- =========================================
-- 3) DIGITAL_SIGNATURES: hide encrypted_private_key
-- =========================================
DROP POLICY IF EXISTS "Users can view signatures" ON public.digital_signatures;

CREATE POLICY "Owners can view own signature"
ON public.digital_signatures FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all signatures"
ON public.digital_signatures FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Public view exposing only public_key fields for verification
CREATE OR REPLACE VIEW public.signature_public_keys
WITH (security_invoker = false) AS
SELECT user_id, public_key, is_active
FROM public.digital_signatures;

GRANT SELECT ON public.signature_public_keys TO authenticated;

-- =========================================
-- 4) NOTIFICATIONS: restrict cross-user inserts
-- =========================================
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert own notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- SECURITY DEFINER function for workflow notifications
CREATE OR REPLACE FUNCTION public.create_workflow_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_voucher_type text DEFAULT NULL,
  p_voucher_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only workflow roles may notify other users
  IF p_user_id <> v_caller AND NOT (
       public.has_role(v_caller, 'admin')
    OR public.has_role(v_caller, 'lanh_dao')
    OR public.has_role(v_caller, 'ke_toan')
    OR public.has_role(v_caller, 'nguoi_lap')
    OR public.has_role(v_caller, 'phu_trach_dia_ban')
  ) THEN
    RAISE EXCEPTION 'Not allowed to create notification for another user';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, related_voucher_type, related_voucher_id)
  VALUES (p_user_id, p_type, p_title, p_message, p_voucher_type, p_voucher_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_workflow_notification(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_workflow_notification(uuid, text, text, text, text, text) TO authenticated;

-- =========================================
-- 5) Tighten trigger function execute rights
-- =========================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_admin_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
