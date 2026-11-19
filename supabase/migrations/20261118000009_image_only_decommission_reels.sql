-- VORTEX image-only media policy and safe decommissioning of legacy Reels.
-- Existing legacy Reel rows are retained in renamed, inaccessible tables so
-- this migration does not silently destroy historical user data.


-- Remove policies created for Reels by migrations 00004/00005/00008.
DROP POLICY IF EXISTS "Reels are viewable by all authenticated users" ON public.reels;
DROP POLICY IF EXISTS "Users can create reels" ON public.reels;
DROP POLICY IF EXISTS "Users or admins can delete reels" ON public.reels;
DROP POLICY IF EXISTS "Reels visible to permitted viewers only" ON public.reels;
DROP POLICY IF EXISTS "Users create their own reels" ON public.reels;
DROP POLICY IF EXISTS "Reel owners and moderators delete reels" ON public.reels;
DROP POLICY IF EXISTS "Reel likes viewable by authenticated" ON public.reel_likes;
DROP POLICY IF EXISTS "Users can toggle their like" ON public.reel_likes;
DROP POLICY IF EXISTS "Users can remove their like" ON public.reel_likes;
DROP POLICY IF EXISTS "Reel likes visible with accessible reel" ON public.reel_likes;
DROP POLICY IF EXISTS "Users like accessible reels when not blocked" ON public.reel_likes;
DROP POLICY IF EXISTS "Users remove their own reel likes" ON public.reel_likes;
DROP POLICY IF EXISTS "Users view own reel bookmarks" ON public.reel_bookmarks;
DROP POLICY IF EXISTS "Users add reel bookmarks" ON public.reel_bookmarks;
DROP POLICY IF EXISTS "Users remove reel bookmarks" ON public.reel_bookmarks;

-- Disable the counter trigger before retaining the historical tables.
DROP TRIGGER IF EXISTS trg_reel_likes_count ON public.reel_likes;
REVOKE ALL ON TABLE public.reels, public.reel_likes, public.reel_bookmarks FROM PUBLIC, anon, authenticated;

-- Preserve the rows but remove the old names from the active product schema.
ALTER TABLE IF EXISTS public.reels RENAME TO legacy_video_reels_disabled_20261118;
ALTER TABLE IF EXISTS public.reel_likes RENAME TO legacy_video_reel_likes_disabled_20261118;
ALTER TABLE IF EXISTS public.reel_bookmarks RENAME TO legacy_video_reel_bookmarks_disabled_20261118;

DROP FUNCTION IF EXISTS public.can_view_reel(UUID);
DROP FUNCTION IF EXISTS public.handle_reel_like_counts();

-- Make existing media tables image-only for all new inserts/updates. NOT VALID
-- preserves existing historic rows; the application excludes those records.
ALTER TABLE public.stories
  DROP CONSTRAINT IF EXISTS stories_media_type_check;
ALTER TABLE public.stories
  ADD CONSTRAINT stories_image_only_check CHECK (media_type = 'image') NOT VALID;

ALTER TABLE public.post_media
  DROP CONSTRAINT IF EXISTS post_media_media_type_check;
ALTER TABLE public.post_media
  ADD CONSTRAINT post_media_image_only_check CHECK (media_type = 'image') NOT VALID;

-- No new video/document objects may be uploaded to media buckets.
UPDATE storage.buckets
   SET public = FALSE,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 WHERE id = 'post_media';

UPDATE storage.buckets
   SET public = FALSE,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 WHERE id = 'attachments';

-- Existing legacy video objects remain stored for data-retention purposes,
-- but Storage policies no longer allow them to be read through these buckets.
DROP POLICY IF EXISTS "Authenticated users can read visible post media" ON storage.objects;
CREATE POLICY "Authenticated users can read visible image post media"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'post_media'
    AND auth.uid() IS NOT NULL
    AND COALESCE(storage.objects.metadata ->> 'mimetype', '') = ANY (
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::TEXT[]
    )
    AND EXISTS (
      SELECT 1
        FROM public.post_media AS media_row
       WHERE media_row.media_url = storage.objects.name
         AND media_row.media_type = 'image'
         AND public.can_view_post(media_row.post_id)
    )
  );

DROP POLICY IF EXISTS "Conversation members can read message attachments" ON storage.objects;
CREATE POLICY "Conversation members can read image message attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND auth.uid() IS NOT NULL
    AND COALESCE(storage.objects.metadata ->> 'mimetype', '') = ANY (
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::TEXT[]
    )
    AND EXISTS (
      SELECT 1
        FROM public.messages AS message_row
       WHERE storage.objects.name = ANY(message_row.attachments)
         AND public.can_access_conversation(message_row.conversation_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_stories_active_images
  ON public.stories (expires_at DESC)
  WHERE media_type = 'image';
