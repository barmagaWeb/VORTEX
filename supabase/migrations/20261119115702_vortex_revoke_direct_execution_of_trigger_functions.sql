-- VORTEX Migration 15
-- Revoke direct API execution of trigger-only SECURITY DEFINER functions.
-- Existing triggers continue to run; these functions are not intended as RPC endpoints.

REVOKE EXECUTE ON FUNCTION public.enforce_private_follow_requests() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_conversation_member_insert_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_conversation_member_privileged_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_notification_identity() FROM PUBLIC, anon, authenticated;
