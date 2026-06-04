-- Stop admins from reading every user's encrypted private key directly.
-- Admins must use get_signature_public_keys() (which excludes the encrypted key).
DROP POLICY IF EXISTS "Admins can view all signatures" ON public.digital_signatures;

-- Allow admins to still see public-key metadata (no encrypted_private_key column access pattern via RPC),
-- by keeping owner-only direct SELECT. Admin management still works via INSERT/UPDATE/DELETE policies.

-- Remove the direct self-insert path on notifications.
-- All notification creation must go through create_workflow_notification() SECURITY DEFINER RPC.
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;