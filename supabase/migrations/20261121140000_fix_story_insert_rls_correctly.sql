-- Correct the story INSERT policy using the schema and suspension rule
-- established by 20261118000011_private_image_story_storage.sql.
-- This migration is additive and safe to apply once; it does not touch story rows.
BEGIN;

-- Remove both the original policy and the earlier incorrect attempted repair.
DROP POLICY IF EXISTS "Users can create stories" ON public.stories;
DROP POLICY IF EXISTS "Users create their own stories" ON public.stories;
DROP POLICY IF EXISTS "Users create their own image stories" ON public.stories;

-- Match the application's image-only story flow and preserve suspension checks.
CREATE POLICY "Users create their own image stories"
  ON public.stories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND media_type = 'image'
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles AS profile_row
      WHERE profile_row.id = auth.uid()
        AND profile_row.is_suspended = TRUE
    )
  );

COMMIT;
