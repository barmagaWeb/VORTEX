-- Private image-only storage for Stories. Story rows hold object paths, never
-- expiring signed URLs or browser data URLs in a configured Supabase project.


INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'story_media',
  'story_media',
  FALSE,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Stories are viewable by authenticated users" ON public.stories;
DROP POLICY IF EXISTS "Stories visible to permitted viewers only" ON public.stories;
CREATE POLICY "Image stories visible to permitted viewers only"
  ON public.stories FOR SELECT
  USING (media_type = 'image' AND public.can_view_story(id));

DROP POLICY IF EXISTS "Users can create stories" ON public.stories;
DROP POLICY IF EXISTS "Users create their own stories" ON public.stories;
CREATE POLICY "Users create their own image stories"
  ON public.stories FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND media_type = 'image'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles AS profile_row
      WHERE profile_row.id = auth.uid() AND profile_row.is_suspended = TRUE
    )
  );

DROP POLICY IF EXISTS "Story owners can upload their own images" ON storage.objects;
CREATE POLICY "Story owners can upload their own images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'story_media'
    AND auth.role() = 'authenticated'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can read active story images" ON storage.objects;
CREATE POLICY "Users can read active story images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'story_media'
    AND auth.role() = 'authenticated'
    AND COALESCE(storage.objects.metadata ->> 'mimetype', '') = ANY (
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::TEXT[]
    )
    AND EXISTS (
      SELECT 1 FROM public.stories AS story_row
      WHERE story_row.media_url = storage.objects.name
        AND story_row.media_type = 'image'
        AND story_row.expires_at > pg_catalog.now()
        AND public.can_view_story(story_row.id)
    )
  );

DROP POLICY IF EXISTS "Story owners can delete their own images" ON storage.objects;
CREATE POLICY "Story owners can delete their own images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'story_media'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );
