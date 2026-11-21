-- Keep story creation policy aligned with the trusted active-account helper.
-- This is additive and does not modify existing story rows.
GRANT EXECUTE ON FUNCTION public.is_account_active(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users create their own image stories" ON public.stories;
CREATE POLICY "Users create their own image stories"
  ON public.stories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
    AND media_type = 'image'
    AND public.is_account_active((SELECT auth.uid()))
  );
