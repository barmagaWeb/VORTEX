-- Fix INSERT ... RETURNING for Stories.
-- The owner must be able to read their own inserted row directly. Relying
-- only on can_view_story(id) fails inside the same INSERT statement because
-- its STABLE lookup cannot see the newly inserted row in that command snapshot.
DROP POLICY IF EXISTS "Image stories visible to permitted viewers only" ON public.stories;

CREATE POLICY "Image stories visible to permitted viewers only"
  ON public.stories
  FOR SELECT
  USING (
    media_type = 'image'
    AND (
      user_id = (SELECT auth.uid())
      OR public.can_view_story(id)
    )
  );
