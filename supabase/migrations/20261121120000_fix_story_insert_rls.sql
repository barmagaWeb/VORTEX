-- Repair story INSERT authorization without weakening suspended-account protection.
-- Apply only after reviewing the target project's migration history.
BEGIN;

-- Ensure the authenticated role can evaluate the trusted account-state predicate.
GRANT EXECUTE ON FUNCTION public.is_account_active(UUID) TO authenticated;

-- Scope creation explicitly to authenticated users and keep every ownership/state check.
DROP POLICY IF EXISTS "Users create their own image stories" ON public.stories;
CREATE POLICY "Users create their own image stories"
  ON public.stories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND media_type = 'image'
    AND public.is_account_active(auth.uid())
  );

COMMIT;
