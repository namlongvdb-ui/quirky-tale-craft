-- 1. Remove all anon privileges on public tables (no anon policies exist)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- 2. Revoke anon EXECUTE on internal security definer functions
REVOKE EXECUTE ON FUNCTION public.create_workflow_notification(uuid, text, text, text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;

-- 3. app_data: only admins may delete shared data
DROP POLICY IF EXISTS "Authenticated users can delete shared app data" ON public.app_data;
CREATE POLICY "Admins can delete shared app data"
ON public.app_data FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));