-- =============================================================================
-- VORTEX corrective migration 8
-- Community RLS, storage ownership/privacy, SECURITY DEFINER hardening,
-- signup metadata validation, and automatic hashtag indexing.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SECURITY DEFINER routines from migrations 1 and 4 must use an empty
--    search_path. All table references are schema-qualified.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_username TEXT;
  v_name TEXT;
  v_avatar TEXT;
  v_fallback_username TEXT;
BEGIN
  v_username := pg_catalog.lower(
    pg_catalog.regexp_replace(
      COALESCE(NEW.raw_user_meta_data ->> 'username', ''),
      '[^a-zA-Z0-9_]', '', 'g'
    )
  );

  IF pg_catalog.length(v_username) < 3 OR pg_catalog.length(v_username) > 24 THEN
    v_username := 'user_' || pg_catalog.left(pg_catalog.replace(NEW.id::TEXT, '-', ''), 12);
  END IF;

  v_fallback_username := 'user_' || pg_catalog.left(pg_catalog.replace(NEW.id::TEXT, '-', ''), 16);
  v_name := pg_catalog.left(
    pg_catalog.btrim(pg_catalog.regexp_replace(
      COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
      '[[:cntrl:]]', '', 'g'
    )),
    80
  );
  IF v_name = '' THEN
    v_name := 'VORTEX Member';
  END IF;

  -- Never trust an avatar URL supplied in auth metadata. The client does
  -- not need to provide an avatar during signup; profile editing can replace
  -- this default through the authenticated profile/storage workflow.
  v_avatar := 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

  BEGIN
    INSERT INTO public.profiles (id, username, name, avatar)
    VALUES (NEW.id, v_username, v_name, v_avatar)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public.profiles (id, username, name, avatar)
    VALUES (NEW.id, v_fallback_username, v_name, v_avatar)
    ON CONFLICT (id) DO NOTHING;
  END;

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_post_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'post_likes' THEN
      UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_TABLE_NAME = 'comments' THEN
      UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_TABLE_NAME = 'reposts' THEN
      UPDATE public.posts SET reposts_count = reposts_count + 1 WHERE id = NEW.post_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'post_likes' THEN
      UPDATE public.posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
    ELSIF TG_TABLE_NAME = 'comments' THEN
      UPDATE public.posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
    ELSIF TG_TABLE_NAME = 'reposts' THEN
      UPDATE public.posts SET reposts_count = GREATEST(0, reposts_count - 1) WHERE id = OLD.post_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

-- Preserve handle_follow_counts() from migration 5; do not replace the
-- accepted/pending counter implementation here.

CREATE OR REPLACE FUNCTION public.handle_new_story_view()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.stories
     SET views_count = views_count + 1
   WHERE id = NEW.story_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_reel_like_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET likes_count = likes_count + 1 WHERE id = NEW.reel_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels
       SET likes_count = GREATEST(0, likes_count - 1)
     WHERE id = OLD.reel_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 2. Community post access must respect community membership, parent post
--    visibility, block rules, and post ownership on INSERT.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_community_post(
  target_community_id UUID,
  target_post_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.communities AS community_row
      JOIN public.posts AS post_row ON post_row.id = target_post_id
     WHERE community_row.id = target_community_id
       AND public.can_view_post(post_row.id)
       AND (
         community_row.is_private = FALSE
         OR EXISTS (
           SELECT 1
             FROM public.community_members AS member_row
            WHERE member_row.community_id = community_row.id
              AND member_row.user_id = auth.uid()
         )
       )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_add_community_post(
  target_community_id UUID,
  target_post_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.posts AS post_row
      JOIN public.community_members AS member_row
        ON member_row.community_id = target_community_id
       AND member_row.user_id = auth.uid()
     WHERE post_row.id = target_post_id
       AND post_row.author_id = auth.uid()
       AND (post_row.community_id IS NULL OR post_row.community_id = target_community_id)
  );
$function$;

DROP POLICY IF EXISTS "Community posts viewable" ON public.community_posts;
DROP POLICY IF EXISTS "Community members can post to community" ON public.community_posts;
DROP POLICY IF EXISTS "Only visible community posts can be read" ON public.community_posts;
DROP POLICY IF EXISTS "Authors can attach their own posts to communities" ON public.community_posts;

CREATE POLICY "Only visible community posts can be read"
  ON public.community_posts FOR SELECT
  USING (public.can_view_community_post(community_id, post_id));

CREATE POLICY "Authors can attach their own posts to communities"
  ON public.community_posts FOR INSERT
  WITH CHECK (public.can_add_community_post(community_id, post_id));

-- -----------------------------------------------------------------------------
-- 3. Storage write permissions are restricted to the uploader's first folder.
--    Post media becomes private and is only signable when its parent post is
--    visible to the requesting authenticated user.
-- -----------------------------------------------------------------------------
UPDATE storage.buckets
   SET public = FALSE
 WHERE id = 'post_media';

-- Convert previously persisted public post_media URLs to object paths so the
-- client can produce fresh signed URLs on each data read.
UPDATE public.post_media
   SET media_url = pg_catalog.regexp_replace(
     media_url,
     '^https?://[^/]+/storage/v1/object/(public|sign)/post_media/',
     ''
   )
 WHERE media_url ~ '^https?://[^/]+/storage/v1/object/(public|sign)/post_media/';

-- Convert old persisted signed attachment URLs back to object paths. The client
-- now signs these paths whenever the conversation is fetched.
UPDATE public.messages AS message_row
   SET attachments = ARRAY(
     SELECT CASE
       WHEN attachment_value ~ '^https?://[^/]+/storage/v1/object/(public|sign)/attachments/'
         THEN pg_catalog.split_part(
           pg_catalog.regexp_replace(
             attachment_value,
             '^https?://[^/]+/storage/v1/object/(public|sign)/attachments/',
             ''
           ),
           '?', 1
         )
       ELSE attachment_value
     END
       FROM pg_catalog.unnest(message_row.attachments) AS attachment_value
   )
 WHERE EXISTS (
   SELECT 1
     FROM pg_catalog.unnest(message_row.attachments) AS attachment_value
    WHERE attachment_value ~ '^https?://[^/]+/storage/v1/object/(public|sign)/attachments/'
 );

DROP POLICY IF EXISTS "Public read for post media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read visible post media" ON storage.objects;
CREATE POLICY "Authenticated users can read visible post media"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'post_media'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM public.post_media AS media_row
       WHERE media_row.media_url = storage.objects.name
         AND public.can_view_post(media_row.post_id)
    )
  );

DROP POLICY IF EXISTS "Authenticated users can upload community media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload community media in own folder" ON storage.objects;
CREATE POLICY "Users can upload community media in own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'community_media'
    AND auth.uid() IS NOT NULL
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update community media in own folder" ON storage.objects;
CREATE POLICY "Users can update community media in own folder"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'community_media'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'community_media'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete community media in own folder" ON storage.objects;
CREATE POLICY "Users can delete community media in own folder"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'community_media'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

-- Private message attachments: uploads belong to the sender's folder and are
-- readable/signable only after a message references the object in an accessible
-- conversation. The object path (not a signed URL) is stored in messages.
DROP POLICY IF EXISTS "Users can upload their own message attachments" ON storage.objects;
CREATE POLICY "Users can upload their own message attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND auth.uid() IS NOT NULL
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Conversation members can read message attachments" ON storage.objects;
CREATE POLICY "Conversation members can read message attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM public.messages AS message_row
       WHERE storage.objects.name = ANY(message_row.attachments)
         AND public.can_access_conversation(message_row.conversation_id)
    )
  );

DROP POLICY IF EXISTS "Users can update their own message attachments" ON storage.objects;
CREATE POLICY "Users can update their own message attachments"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'attachments'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'attachments'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own message attachments" ON storage.objects;
CREATE POLICY "Users can delete their own message attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

-- -----------------------------------------------------------------------------
-- 4. Restrict helper RPC execution. RLS still invokes these helpers for
--    authenticated requests; anonymous clients cannot probe IDs/block state.
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_moderator() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_blocked_from(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_post(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_conversation(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_add_conversation_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_story(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_reel(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_community_post(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_add_community_post(UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_moderator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked_from(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_post(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_add_conversation_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_story(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_reel(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_community_post(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_add_community_post(UUID, UUID) TO authenticated;

-- Trigger entry points and notification enqueue are not public RPC endpoints.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_post_counters() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_follow_counts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_story_view() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_reel_like_counts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_vortex_notification(UUID, UUID, TEXT, UUID, UUID, UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_vortex_post_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_vortex_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_vortex_follow() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_vortex_repost() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_vortex_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_vortex_community_join() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Hashtags are derived from post content and tags. The trigger runs with
--    owner privileges; clients cannot directly create or attach arbitrary tags.
-- -----------------------------------------------------------------------------
ALTER TABLE public.hashtags ALTER COLUMN posts_count SET DEFAULT 0;

CREATE OR REPLACE FUNCTION public.handle_post_hashtag_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.hashtags
       SET posts_count = posts_count + 1
     WHERE id = NEW.hashtag_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.hashtags
       SET posts_count = GREATEST(0, posts_count - 1)
     WHERE id = OLD.hashtag_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_post_hashtag_counts ON public.post_hashtags;
CREATE TRIGGER trg_post_hashtag_counts
AFTER INSERT OR DELETE ON public.post_hashtags
FOR EACH ROW EXECUTE FUNCTION public.handle_post_hashtag_counts();

CREATE OR REPLACE FUNCTION public.sync_post_hashtags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tag TEXT;
  v_hashtag_id UUID;
BEGIN
  DELETE FROM public.post_hashtags WHERE post_id = NEW.id;

  FOR v_tag IN
    SELECT DISTINCT pg_catalog.lower(pg_catalog.btrim(tag_value))
      FROM (
        SELECT pg_catalog.unnest(COALESCE(NEW.tags, ARRAY[]::TEXT[])) AS tag_value
        UNION ALL
        SELECT (pg_catalog.regexp_matches(COALESCE(NEW.content, ''), '#([[:alnum:]_]+)', 'g'))[1]
      ) AS extracted
     WHERE tag_value IS NOT NULL
       AND pg_catalog.btrim(tag_value) <> ''
       AND pg_catalog.length(pg_catalog.btrim(tag_value)) BETWEEN 1 AND 64
  LOOP
    v_tag := pg_catalog.regexp_replace(v_tag, '^#', '');
    IF v_tag = '' THEN
      CONTINUE;
    END IF;

    INSERT INTO public.hashtags (name, posts_count)
    VALUES (v_tag, 0)
    ON CONFLICT (name) DO NOTHING;

    SELECT id INTO v_hashtag_id
      FROM public.hashtags
     WHERE name = v_tag;

    IF v_hashtag_id IS NOT NULL THEN
      INSERT INTO public.post_hashtags (post_id, hashtag_id)
      VALUES (NEW.id, v_hashtag_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'VORTEX hashtag sync failed for post %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_post_hashtags ON public.posts;
CREATE TRIGGER trg_sync_post_hashtags
AFTER INSERT OR UPDATE OF content, tags ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.sync_post_hashtags();

-- Backfill hash links for posts created before this migration.
UPDATE public.posts
   SET tags = COALESCE(tags, ARRAY[]::TEXT[]);

UPDATE public.hashtags AS hashtag_row
   SET posts_count = (
     SELECT pg_catalog.count(*)::INTEGER
       FROM public.post_hashtags AS link_row
      WHERE link_row.hashtag_id = hashtag_row.id
   );

DROP POLICY IF EXISTS "Post hashtags are viewable by everyone" ON public.post_hashtags;
DROP POLICY IF EXISTS "Post hashtags are viewable for visible posts" ON public.post_hashtags;
CREATE POLICY "Post hashtags are viewable for visible posts"
  ON public.post_hashtags FOR SELECT
  USING (public.can_view_post(post_id));

REVOKE EXECUTE ON FUNCTION public.handle_post_hashtag_counts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_post_hashtags() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates a profile from sanitized username/name metadata, uses a server-selected default avatar, and never accepts role or moderation fields from client metadata.';
COMMENT ON FUNCTION public.can_view_community_post(UUID, UUID) IS
  'RLS helper requiring an authenticated viewer, community membership for private communities, and parent post visibility.';
