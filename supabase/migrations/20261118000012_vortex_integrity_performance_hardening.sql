-- VORTEX: follow-up integrity, ownership, suspension and query hardening.
-- Additive and safe for projects where migrations 1-11 are already recorded.
-- No user content is deleted or rewritten by this migration.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Case-insensitive usernames. Abort with a clear message instead of silently
-- renaming an existing account if legacy data already contains collisions.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.profiles
    GROUP BY pg_catalog.lower(username)
    HAVING pg_catalog.count(*) > 1
  ) THEN
    RAISE EXCEPTION 'VORTEX migration 12: duplicate usernames ignoring case exist; resolve those account names before retrying.';
  END IF;
END;
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower_unique
  ON public.profiles (pg_catalog.lower(username));

CREATE INDEX IF NOT EXISTS idx_posts_for_you_rank
  ON public.posts (likes_count DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_posts_latest_feed
  ON public.posts (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_posts_author_feed
  ON public.posts (author_id, created_at DESC, id DESC);

DO $migration$
DECLARE
  v_opclass_schema TEXT;
  v_target RECORD;
BEGIN
  SELECT namespace_row.nspname
    INTO v_opclass_schema
    FROM pg_catalog.pg_opclass AS opclass_row
    JOIN pg_catalog.pg_namespace AS namespace_row
      ON namespace_row.oid = opclass_row.opcnamespace
   WHERE opclass_row.opcname = 'gin_trgm_ops'
   ORDER BY (namespace_row.nspname = 'extensions') DESC
   LIMIT 1;

  IF v_opclass_schema IS NULL THEN
    RAISE EXCEPTION 'VORTEX migration 12: pg_trgm gin_trgm_ops operator class is unavailable.';
  END IF;

  FOR v_target IN
    SELECT * FROM (VALUES
      ('posts', 'content'),
      ('profiles', 'username'),
      ('profiles', 'name'),
      ('profiles', 'bio'),
      ('communities', 'name'),
      ('communities', 'description'),
      ('communities', 'category')
    ) AS targets(table_name, column_name)
  LOOP
    EXECUTE pg_catalog.format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I USING gin (%I %I.gin_trgm_ops)',
      'idx_' || v_target.table_name || '_' || v_target.column_name || '_trgm',
      v_target.table_name,
      v_target.column_name,
      v_opclass_schema
    );
  END LOOP;
END;
$migration$;

-- Trusted identity/state helper used by RLS and SECURITY DEFINER routines.
CREATE OR REPLACE FUNCTION public.is_account_active(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT target_user_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.profiles AS profile_row
     WHERE profile_row.id = target_user_id
       AND profile_row.is_suspended = FALSE
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.is_account_active(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_account_active(UUID) TO authenticated;

-- Validate profile text and canonicalize usernames at the database boundary.
CREATE OR REPLACE FUNCTION public.validate_vortex_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.username := pg_catalog.lower(pg_catalog.btrim(COALESCE(NEW.username, '')));
  IF NEW.username !~ '^[a-z0-9_]{3,24}$'
     OR NEW.username = ANY (ARRAY['admin', 'administrator', 'moderator', 'support', 'system', 'root', 'vortex']) THEN
    RAISE EXCEPTION 'Username must be 3-24 letters, numbers or underscores and cannot be reserved.'
      USING ERRCODE = '22023';
  END IF;

  NEW.name := pg_catalog.btrim(COALESCE(NEW.name, ''));
  IF NEW.name = '' OR pg_catalog.char_length(NEW.name) > 80 THEN
    RAISE EXCEPTION 'Display name must contain 1-80 characters.' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.char_length(COALESCE(NEW.bio, '')) > 500 THEN
    RAISE EXCEPTION 'Bio cannot exceed 500 characters.' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.char_length(COALESCE(NEW.location, '')) > 120 THEN
    RAISE EXCEPTION 'Location cannot exceed 120 characters.' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.char_length(COALESCE(NEW.website, '')) > 2048 THEN
    RAISE EXCEPTION 'Website URL is too long.' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_vortex_profile_fields ON public.profiles;
CREATE TRIGGER trg_validate_vortex_profile_fields
BEFORE INSERT OR UPDATE OF username, name, bio, location, website ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_vortex_profile_fields();

-- Do not trust custom GUC flags for privileged counters: authenticated clients
-- can set custom settings themselves. Only trusted database roles may alter
-- the counters directly; trigger-owned functions run with their owner role.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.role IS DISTINCT FROM 'user'
         OR COALESCE(NEW.verified, FALSE)
         OR COALESCE(NEW.is_suspended, FALSE) THEN
        RAISE EXCEPTION 'Privileged profile fields can only be set by trusted administrators.'
          USING ERRCODE = '42501';
      END IF;
      IF COALESCE(NEW.followers_count, 0) <> 0
         OR COALESCE(NEW.following_count, 0) <> 0
         OR COALESCE(NEW.posts_count, 0) <> 0 THEN
        RAISE EXCEPTION 'Profile counters are database-managed.' USING ERRCODE = '42501';
      END IF;
    ELSE
      IF (NEW.role IS DISTINCT FROM OLD.role
          OR NEW.verified IS DISTINCT FROM OLD.verified
          OR NEW.is_suspended IS DISTINCT FROM OLD.is_suspended)
         AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only an administrator can change role, verification or suspension state.'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.followers_count IS DISTINCT FROM OLD.followers_count
         OR NEW.following_count IS DISTINCT FROM OLD.following_count
         OR NEW.posts_count IS DISTINCT FROM OLD.posts_count THEN
        RAISE EXCEPTION 'Profile counters are database-managed.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_fields
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privileged_fields();

-- Stop silently replacing a requested username with a random fallback when a
-- case-insensitive collision occurs. The unique index above is the final race-safe check.
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
BEGIN
  v_username := pg_catalog.lower(pg_catalog.regexp_replace(
    COALESCE(NEW.raw_user_meta_data ->> 'username', ''),
    '[^a-zA-Z0-9_]', '', 'g'
  ));
  IF pg_catalog.length(v_username) < 3 OR pg_catalog.length(v_username) > 24 THEN
    v_username := 'user_' || pg_catalog.left(pg_catalog.replace(NEW.id::TEXT, '-', ''), 12);
  END IF;

  v_name := pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''), '[[:cntrl:]]', '', 'g'
  )), 80);
  IF v_name = '' THEN v_name := 'VORTEX Member'; END IF;

  v_avatar := 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

  BEGIN
    INSERT INTO public.profiles (id, username, name, avatar)
    VALUES (NEW.id, v_username, v_name, v_avatar)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'That username is already taken. Please choose a different one.'
      USING ERRCODE = '23505';
  END;

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Counters cannot be supplied in a post INSERT or forged in an UPDATE.
CREATE OR REPLACE FUNCTION public.protect_post_managed_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF TG_OP = 'INSERT' THEN
      IF COALESCE(NEW.likes_count, 0) <> 0
         OR COALESCE(NEW.comments_count, 0) <> 0
         OR COALESCE(NEW.reposts_count, 0) <> 0
         OR COALESCE(NEW.shares_count, 0) <> 0 THEN
        RAISE EXCEPTION 'Post counters are database-managed.' USING ERRCODE = '42501';
      END IF;
    ELSE
      IF NEW.likes_count IS DISTINCT FROM OLD.likes_count
         OR NEW.comments_count IS DISTINCT FROM OLD.comments_count
         OR NEW.reposts_count IS DISTINCT FROM OLD.reposts_count
         OR NEW.shares_count IS DISTINCT FROM OLD.shares_count THEN
        RAISE EXCEPTION 'Post counters are database-managed.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_post_managed_counters ON public.posts;
CREATE TRIGGER trg_protect_post_managed_counters
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.protect_post_managed_counters();

-- Maintain the profile post count from trusted post insert/delete events.
CREATE OR REPLACE FUNCTION public.handle_profile_post_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles
       SET posts_count = posts_count + 1
     WHERE id = NEW.author_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
       SET posts_count = GREATEST(0, posts_count - 1)
     WHERE id = OLD.author_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_profile_post_count ON public.posts;
CREATE TRIGGER trg_vortex_profile_post_count
AFTER INSERT OR DELETE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.handle_profile_post_count();

UPDATE public.profiles AS profile_row
   SET posts_count = (
     SELECT pg_catalog.count(*)::INTEGER
       FROM public.posts AS post_row
      WHERE post_row.author_id = profile_row.id
   );

-- The community member count is derived from actual membership rows. This
-- removes client-controlled count RPC calls and makes concurrent joins atomic.
ALTER TABLE public.communities ALTER COLUMN member_count SET DEFAULT 0;

CREATE OR REPLACE FUNCTION public.protect_community_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF TG_OP = 'INSERT' AND COALESCE(NEW.member_count, 0) <> 0 THEN
      RAISE EXCEPTION 'Community member count is database-managed.' USING ERRCODE = '42501';
    ELSIF TG_OP = 'UPDATE' AND NEW.member_count IS DISTINCT FROM OLD.member_count THEN
      RAISE EXCEPTION 'Community member count is database-managed.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_community_member_count ON public.communities;
CREATE TRIGGER trg_protect_community_member_count
BEFORE INSERT OR UPDATE ON public.communities
FOR EACH ROW
EXECUTE FUNCTION public.protect_community_member_count();

CREATE OR REPLACE FUNCTION public.handle_community_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.communities
       SET member_count = member_count + 1
     WHERE id = NEW.community_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.communities
       SET member_count = GREATEST(0, member_count - 1)
     WHERE id = OLD.community_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_community_member_count ON public.community_members;
CREATE TRIGGER trg_vortex_community_member_count
AFTER INSERT OR DELETE ON public.community_members
FOR EACH ROW
EXECUTE FUNCTION public.handle_community_member_count();

UPDATE public.communities AS community_row
   SET member_count = (
     SELECT pg_catalog.count(*)::INTEGER
       FROM public.community_members AS member_row
      WHERE member_row.community_id = community_row.id
   );

-- Content/attachment limits are enforced on the server regardless of client UI.
CREATE OR REPLACE FUNCTION public.enforce_vortex_content_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  attachment_path TEXT;
BEGIN
  IF TG_TABLE_NAME = 'posts' THEN
    IF pg_catalog.char_length(COALESCE(NEW.content, '')) > 10000 THEN
      RAISE EXCEPTION 'Post content cannot exceed 10000 characters.' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(pg_catalog.cardinality(NEW.tags), 0) > 30 THEN
      RAISE EXCEPTION 'A post can contain at most 30 tags.' USING ERRCODE = '22023';
    END IF;
  ELSIF TG_TABLE_NAME = 'comments' THEN
    IF pg_catalog.char_length(COALESCE(NEW.content, '')) > 5000 THEN
      RAISE EXCEPTION 'Comment content cannot exceed 5000 characters.' USING ERRCODE = '22023';
    END IF;
  ELSIF TG_TABLE_NAME = 'messages' THEN
    IF pg_catalog.char_length(COALESCE(NEW.content, '')) > 5000 THEN
      RAISE EXCEPTION 'Message content cannot exceed 5000 characters.' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(pg_catalog.cardinality(NEW.attachments), 0) > 4 THEN
      RAISE EXCEPTION 'A message can contain at most four image attachments.' USING ERRCODE = '22023';
    END IF;
    IF pg_catalog.btrim(COALESCE(NEW.content, '')) = ''
       AND COALESCE(pg_catalog.cardinality(NEW.attachments), 0) = 0 THEN
      RAISE EXCEPTION 'A message must contain text or an image attachment.' USING ERRCODE = '22023';
    END IF;
    FOREACH attachment_path IN ARRAY COALESCE(NEW.attachments, '{}'::TEXT[]) LOOP
      IF attachment_path ~* '^(https?:|data:|blob:|javascript:)'
         OR pg_catalog.split_part(attachment_path, '/', 1) <> NEW.sender_id::TEXT
         OR pg_catalog.split_part(attachment_path, '/', 2) <> NEW.conversation_id::TEXT
         OR attachment_path LIKE '%..%'
         OR attachment_path ~ '[[:cntrl:]]'
         OR pg_catalog.length(attachment_path) > 1024 THEN
        RAISE EXCEPTION 'Message attachments must be stored under the sender/conversation folder.'
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  ELSIF TG_TABLE_NAME = 'stories' THEN
    IF pg_catalog.char_length(COALESCE(NEW.caption, '')) > 500 THEN
      RAISE EXCEPTION 'Story caption cannot exceed 500 characters.' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_post_content_limits ON public.posts;
CREATE TRIGGER trg_vortex_post_content_limits
BEFORE INSERT OR UPDATE OF content, tags ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.enforce_vortex_content_limits();

DROP TRIGGER IF EXISTS trg_vortex_comment_content_limits ON public.comments;
CREATE TRIGGER trg_vortex_comment_content_limits
BEFORE INSERT OR UPDATE OF content ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_vortex_content_limits();

DROP TRIGGER IF EXISTS trg_vortex_message_content_limits ON public.messages;
CREATE TRIGGER trg_vortex_message_content_limits
BEFORE INSERT OR UPDATE OF content, attachments, sender_id, conversation_id ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_vortex_content_limits();

DROP TRIGGER IF EXISTS trg_vortex_story_content_limits ON public.stories;
CREATE TRIGGER trg_vortex_story_content_limits
BEFORE INSERT OR UPDATE OF caption ON public.stories
FOR EACH ROW EXECUTE FUNCTION public.enforce_vortex_content_limits();

UPDATE storage.buckets
   SET file_size_limit = 10485760
 WHERE id IN ('post_media', 'attachments');

-- Validate that private media object paths belong to the resource owner and
-- prohibit external URLs/data URLs from bypassing private Storage policies.
CREATE OR REPLACE FUNCTION public.enforce_post_media_owner_path()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_author_id UUID;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.media_url IS NOT DISTINCT FROM OLD.media_url
     AND NEW.post_id IS NOT DISTINCT FROM OLD.post_id THEN
    RETURN NEW;
  END IF;

  SELECT post_row.author_id INTO v_author_id
    FROM public.posts AS post_row
   WHERE post_row.id = NEW.post_id;

  IF v_author_id IS NULL
     OR NEW.media_url ~* '^(https?:|data:|blob:|javascript:)'
     OR pg_catalog.split_part(NEW.media_url, '/', 1) <> v_author_id::TEXT
     OR NEW.media_url LIKE '%..%'
     OR NEW.media_url ~ '[[:cntrl:]]'
     OR pg_catalog.length(NEW.media_url) > 1024 THEN
    RAISE EXCEPTION 'Post media must use an object path inside the post author folder.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_post_media_owner_path ON public.post_media;
CREATE TRIGGER trg_vortex_post_media_owner_path
BEFORE INSERT OR UPDATE OF media_url, post_id ON public.post_media
FOR EACH ROW EXECUTE FUNCTION public.enforce_post_media_owner_path();

CREATE OR REPLACE FUNCTION public.enforce_story_media_owner_path()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.media_url IS NOT DISTINCT FROM OLD.media_url
     AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.media_type <> 'image'
     OR NEW.media_url ~* '^(https?:|data:|blob:|javascript:)'
     OR pg_catalog.split_part(NEW.media_url, '/', 1) <> NEW.user_id::TEXT
     OR NEW.media_url LIKE '%..%'
     OR NEW.media_url ~ '[[:cntrl:]]'
     OR pg_catalog.length(NEW.media_url) > 1024 THEN
    RAISE EXCEPTION 'Story media must be an image object path inside the story owner folder.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_story_media_owner_path ON public.stories;
CREATE TRIGGER trg_vortex_story_media_owner_path
BEFORE INSERT OR UPDATE OF media_url, user_id, media_type ON public.stories
FOR EACH ROW EXECUTE FUNCTION public.enforce_story_media_owner_path();

-- Active-state check for new writes. Suspension disables publishing and every
-- social interaction, not only creating a post.
CREATE OR REPLACE FUNCTION public.can_access_conversation(target_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND public.is_account_active(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.conversation_members AS self_member
       WHERE self_member.conversation_id = target_conversation_id
         AND self_member.user_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.conversation_members AS other_member
       WHERE other_member.conversation_id = target_conversation_id
         AND other_member.user_id <> auth.uid()
         AND public.is_blocked_from(other_member.user_id)
    );
$function$;

CREATE OR REPLACE FUNCTION public.can_add_conversation_member(
  target_conversation_id UUID,
  target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND public.is_account_active(auth.uid())
    AND public.is_account_active(target_user_id)
    AND EXISTS (
      SELECT 1 FROM public.conversations AS conversation_row
       WHERE conversation_row.id = target_conversation_id
         AND conversation_row.created_by = auth.uid()
    )
    AND (
      target_user_id = auth.uid()
      OR NOT public.is_blocked_from(target_user_id)
    );
$function$;

-- Recreate the follow counter trigger after migration 8's historical version,
-- preserving accepted/pending transitions and keeping counter writes trusted.
CREATE OR REPLACE FUNCTION public.handle_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'accepted' THEN
      UPDATE public.profiles
         SET following_count = following_count + 1
       WHERE id = NEW.follower_id;
      UPDATE public.profiles
         SET followers_count = followers_count + 1
       WHERE id = NEW.following_id;
    END IF;
    RETURN NULL;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'accepted' THEN
      UPDATE public.profiles
         SET following_count = GREATEST(0, following_count - 1)
       WHERE id = OLD.follower_id;
      UPDATE public.profiles
         SET followers_count = GREATEST(0, followers_count - 1)
       WHERE id = OLD.following_id;
    END IF;
    RETURN NULL;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.status = 'accepted' THEN
      UPDATE public.profiles
         SET following_count = GREATEST(0, following_count - 1)
       WHERE id = OLD.follower_id;
      UPDATE public.profiles
         SET followers_count = GREATEST(0, followers_count - 1)
       WHERE id = OLD.following_id;
    ELSIF NEW.status = 'accepted' THEN
      UPDATE public.profiles
         SET following_count = following_count + 1
       WHERE id = NEW.follower_id;
      UPDATE public.profiles
         SET followers_count = followers_count + 1
       WHERE id = NEW.following_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_follow_counts ON public.follows;
CREATE TRIGGER trg_follow_counts
AFTER INSERT OR DELETE OR UPDATE OF status ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.handle_follow_counts();

-- Prevent direct media upload into someone else's private folder.
DROP POLICY IF EXISTS "Authenticated users can upload post media" ON storage.objects;
CREATE POLICY "Users upload post media into their own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'post_media'
    AND auth.uid() IS NOT NULL
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
    AND public.is_account_active(auth.uid())
  );

DROP POLICY IF EXISTS "Users can upload their own message attachments" ON storage.objects;
CREATE POLICY "Users can upload their own message attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND auth.uid() IS NOT NULL
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
    AND public.is_account_active(auth.uid())
  );

DROP POLICY IF EXISTS "Users can upload their own story images" ON storage.objects;
DROP POLICY IF EXISTS "Story owners can upload their own images" ON storage.objects;
CREATE POLICY "Story owners can upload their own images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'story_media'
    AND auth.uid() IS NOT NULL
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
    AND public.is_account_active(auth.uid())
  );

-- Replace interaction policies with active-account aware policies.
DROP POLICY IF EXISTS "Users create their own image stories" ON public.stories;
CREATE POLICY "Users create their own image stories"
  ON public.stories FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND media_type = 'image'
    AND public.is_account_active(auth.uid())
  );

DROP POLICY IF EXISTS "Users can only view and manage their own bookmarks" ON public.bookmarks;
CREATE POLICY "Users read their own bookmarks"
  ON public.bookmarks FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Active users bookmark accessible posts"
  ON public.bookmarks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_account_active(auth.uid())
    AND public.can_view_post(post_id)
  );
CREATE POLICY "Users remove their own bookmarks"
  ON public.bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- Existing authors may add media to their own posts, but a suspended account
-- must not be able to keep modifying its content after suspension.
DROP POLICY IF EXISTS "Authors add media to their own posts" ON public.post_media;
CREATE POLICY "Authors add media to their own posts"
  ON public.post_media FOR INSERT
  WITH CHECK (
    public.is_account_active(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.posts AS post_row
       WHERE post_row.id = post_id
         AND post_row.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users create posts for themselves" ON public.posts;
CREATE POLICY "Users create posts for themselves"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = author_id AND public.is_account_active(auth.uid()));

DROP POLICY IF EXISTS "Authors update their own posts" ON public.posts;
CREATE POLICY "Authors update their own posts"
  ON public.posts FOR UPDATE
  USING (auth.uid() = author_id AND public.is_account_active(auth.uid()))
  WITH CHECK (auth.uid() = author_id AND public.is_account_active(auth.uid()));

DROP POLICY IF EXISTS "Users comment only where interaction is allowed" ON public.comments;
CREATE POLICY "Users comment only where interaction is allowed"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND public.is_account_active(auth.uid())
    AND public.can_view_post(post_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.posts AS post_row
       WHERE post_row.id = post_id
         AND public.is_blocked_from(post_row.author_id)
    )
    AND (
      parent_comment_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.comments AS parent_row
         WHERE parent_row.id = parent_comment_id
           AND parent_row.post_id = post_id
           AND NOT public.is_blocked_from(parent_row.author_id)
      )
    )
  );

DROP POLICY IF EXISTS "Authors update their own visible comments" ON public.comments;
CREATE POLICY "Authors update their own visible comments"
  ON public.comments FOR UPDATE
  USING (auth.uid() = author_id AND public.is_account_active(auth.uid()) AND public.can_view_post(post_id))
  WITH CHECK (auth.uid() = author_id AND public.is_account_active(auth.uid()) AND public.can_view_post(post_id));

DROP POLICY IF EXISTS "Users like accessible posts when not blocked" ON public.post_likes;
CREATE POLICY "Users like accessible posts when not blocked"
  ON public.post_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_account_active(auth.uid())
    AND public.can_view_post(post_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.posts AS post_row
       WHERE post_row.id = post_id AND public.is_blocked_from(post_row.author_id)
    )
  );

DROP POLICY IF EXISTS "Users like accessible comments when not blocked" ON public.comment_likes;
CREATE POLICY "Users like accessible comments when not blocked"
  ON public.comment_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_account_active(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.comments AS comment_row
       WHERE comment_row.id = comment_id
         AND public.can_view_post(comment_row.post_id)
         AND NOT public.is_blocked_from(comment_row.author_id)
    )
  );

DROP POLICY IF EXISTS "Users repost accessible posts when not blocked" ON public.reposts;
CREATE POLICY "Users repost accessible posts when not blocked"
  ON public.reposts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_account_active(auth.uid())
    AND public.can_view_post(post_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.posts AS post_row
       WHERE post_row.id = post_id AND public.is_blocked_from(post_row.author_id)
    )
  );

DROP POLICY IF EXISTS "Users follow accounts only when not blocked" ON public.follows;
CREATE POLICY "Users follow accounts only when not blocked"
  ON public.follows FOR INSERT
  WITH CHECK (
    auth.uid() = follower_id
    AND public.is_account_active(auth.uid())
    AND follower_id <> following_id
    AND public.is_account_active(following_id)
    AND NOT public.is_blocked_from(following_id)
  );

DROP POLICY IF EXISTS "Users accept pending follow requests for their account" ON public.follows;
CREATE POLICY "Users accept pending follow requests for their account"
  ON public.follows FOR UPDATE
  USING (auth.uid() = following_id AND status = 'pending' AND public.is_account_active(auth.uid())
         AND NOT public.is_blocked_from(follower_id))
  WITH CHECK (auth.uid() = following_id AND status = 'accepted' AND public.is_account_active(auth.uid())
              AND NOT public.is_blocked_from(follower_id));

DROP POLICY IF EXISTS "Users record views only for accessible stories" ON public.story_views;
CREATE POLICY "Users record views only for accessible stories"
  ON public.story_views FOR INSERT
  WITH CHECK (
    auth.uid() = viewer_id
    AND public.is_account_active(auth.uid())
    AND public.can_view_story(story_id)
  );

DROP POLICY IF EXISTS "Users block other accounts" ON public.user_blocks;
CREATE POLICY "Users block other accounts"
  ON public.user_blocks FOR INSERT
  WITH CHECK (
    auth.uid() = blocker_id
    AND blocker_id <> blocked_id
    AND public.is_account_active(auth.uid())
  );

DROP POLICY IF EXISTS "Authors can attach their own posts to communities" ON public.community_posts;
CREATE POLICY "Authors can attach their own posts to communities"
  ON public.community_posts FOR INSERT
  WITH CHECK (
    public.is_account_active(auth.uid())
    AND public.can_add_community_post(community_id, post_id)
  );

DROP POLICY IF EXISTS "Users send messages only in accessible conversations" ON public.messages;
CREATE POLICY "Users send messages only in accessible conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_account_active(auth.uid())
    AND public.can_access_conversation(conversation_id)
  );

DROP POLICY IF EXISTS "Users join communities with permitted membership role" ON public.community_members;
CREATE POLICY "Users join communities with permitted membership role"
  ON public.community_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_account_active(auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.communities AS community_row
       WHERE community_row.id = community_id
         AND public.is_blocked_from(community_row.created_by)
    )
    AND (
      role = 'member'
      OR public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.communities AS community_row
         WHERE community_row.id = community_id AND community_row.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create communities" ON public.communities;
CREATE POLICY "Authenticated users can create communities"
  ON public.communities FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND public.is_account_active(auth.uid())
    AND COALESCE(member_count, 0) = 0
  );

-- Conversation creation/member-addition SECURITY DEFINER paths also pass
-- through these triggers, so suspended accounts cannot create or populate DMs.
CREATE OR REPLACE FUNCTION public.protect_conversation_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.created_by IS NULL OR NOT public.is_account_active(NEW.created_by) THEN
    RAISE EXCEPTION 'An active account is required to create a conversation.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_protect_conversation_creation ON public.conversations;
CREATE TRIGGER trg_vortex_protect_conversation_creation
BEFORE INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.protect_conversation_creation();

CREATE OR REPLACE FUNCTION public.protect_conversation_membership_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT created_by INTO v_owner_id
    FROM public.conversations
   WHERE id = NEW.conversation_id;
  IF NOT public.is_account_active(NEW.user_id)
     OR NOT public.is_account_active(v_owner_id) THEN
    RAISE EXCEPTION 'Active accounts are required for conversation membership.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_protect_conversation_membership_insert ON public.conversation_members;
CREATE TRIGGER trg_vortex_protect_conversation_membership_insert
BEFORE INSERT ON public.conversation_members
FOR EACH ROW EXECUTE FUNCTION public.protect_conversation_membership_insert();

-- Basic database-enforced write rate limits. The private table is not exposed
-- through PostgREST; one row is maintained per user/action/minute.
CREATE SCHEMA IF NOT EXISTS vortex_private;
REVOKE ALL ON SCHEMA vortex_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS vortex_private.write_rate_limits (
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, action)
);
ALTER TABLE vortex_private.write_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vortex_private.write_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_vortex_write_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id UUID;
  v_action TEXT;
  v_limit INTEGER;
  v_window TIMESTAMPTZ := pg_catalog.date_trunc('minute', pg_catalog.clock_timestamp());
  v_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'posts' THEN
    v_user_id := NEW.author_id; v_action := 'post'; v_limit := 10;
  ELSIF TG_TABLE_NAME = 'comments' THEN
    v_user_id := NEW.author_id; v_action := 'comment'; v_limit := 30;
  ELSIF TG_TABLE_NAME = 'messages' THEN
    v_user_id := NEW.sender_id; v_action := 'message'; v_limit := 60;
  ELSIF TG_TABLE_NAME = 'follows' THEN
    v_user_id := NEW.follower_id; v_action := 'follow'; v_limit := 30;
  ELSIF TG_TABLE_NAME = 'stories' THEN
    v_user_id := NEW.user_id; v_action := 'story'; v_limit := 10;
  ELSIF TG_TABLE_NAME IN ('post_likes', 'comment_likes') THEN
    v_user_id := NEW.user_id; v_action := 'like'; v_limit := 120;
  ELSIF TG_TABLE_NAME = 'reposts' THEN
    v_user_id := NEW.user_id; v_action := 'repost'; v_limit := 30;
  ELSIF TG_TABLE_NAME = 'bookmarks' THEN
    v_user_id := NEW.user_id; v_action := 'bookmark'; v_limit := 60;
  ELSIF TG_TABLE_NAME = 'story_views' THEN
    v_user_id := NEW.viewer_id; v_action := 'story_view'; v_limit := 120;
  ELSIF TG_TABLE_NAME = 'community_members' THEN
    v_user_id := NEW.user_id; v_action := 'community_join'; v_limit := 20;
  ELSIF TG_TABLE_NAME = 'user_blocks' THEN
    v_user_id := NEW.blocker_id; v_action := 'block'; v_limit := 20;
  ELSE
    RETURN NEW;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated account required.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO vortex_private.write_rate_limits(user_id, action, window_start, event_count)
  VALUES (v_user_id, v_action, v_window, 1)
  ON CONFLICT (user_id, action)
  DO UPDATE SET
    event_count = CASE
      WHEN vortex_private.write_rate_limits.window_start = EXCLUDED.window_start
        THEN vortex_private.write_rate_limits.event_count + 1
      ELSE 1
    END,
    window_start = EXCLUDED.window_start
  RETURNING event_count INTO v_count;

  IF v_count > v_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded for % writes. Please try again shortly.', v_action
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_rate_posts ON public.posts;
CREATE TRIGGER trg_vortex_rate_posts BEFORE INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.enforce_vortex_write_rate_limit();
DROP TRIGGER IF EXISTS trg_vortex_rate_comments ON public.comments;
CREATE TRIGGER trg_vortex_rate_comments BEFORE INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_vortex_write_rate_limit();
DROP TRIGGER IF EXISTS trg_vortex_rate_messages ON public.messages;
CREATE TRIGGER trg_vortex_rate_messages BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_vortex_write_rate_limit();
DROP TRIGGER IF EXISTS trg_vortex_rate_follows ON public.follows;
CREATE TRIGGER trg_vortex_rate_follows BEFORE INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.enforce_vortex_write_rate_limit();
DROP TRIGGER IF EXISTS trg_vortex_rate_stories ON public.stories;
CREATE TRIGGER trg_vortex_rate_stories BEFORE INSERT ON public.stories
FOR EACH ROW EXECUTE FUNCTION public.enforce_vortex_write_rate_limit();

DROP TRIGGER IF EXISTS trg_vortex_rate_post_likes ON public.post_likes;
CREATE TRIGGER trg_vortex_rate_post_likes BEFORE INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.enforce_vortex_write_rate_limit();
DROP TRIGGER IF EXISTS trg_vortex_rate_comment_likes ON public.comment_likes;
CREATE TRIGGER trg_vortex_rate_comment_likes BEFORE INSERT ON public.comment_likes
FOR EACH ROW EXECUTE FUNCTION public.enforce_vortex_write_rate_limit();
DROP TRIGGER IF EXISTS trg_vortex_rate_reposts ON public.reposts;
CREATE TRIGGER trg_vortex_rate_reposts BEFORE INSERT ON public.reposts
FOR EACH ROW EXECUTE FUNCTION public.enforce_vortex_write_rate_limit();
DROP TRIGGER IF EXISTS trg_vortex_rate_bookmarks ON public.bookmarks;
CREATE TRIGGER trg_vortex_rate_bookmarks BEFORE INSERT ON public.bookmarks
FOR EACH ROW EXECUTE FUNCTION public.enforce_vortex_write_rate_limit();
DROP TRIGGER IF EXISTS trg_vortex_rate_story_views ON public.story_views;
CREATE TRIGGER trg_vortex_rate_story_views BEFORE INSERT ON public.story_views
FOR EACH ROW EXECUTE FUNCTION public.enforce_vortex_write_rate_limit();
DROP TRIGGER IF EXISTS trg_vortex_rate_community_members ON public.community_members;
CREATE TRIGGER trg_vortex_rate_community_members BEFORE INSERT ON public.community_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_vortex_write_rate_limit();
DROP TRIGGER IF EXISTS trg_vortex_rate_user_blocks ON public.user_blocks;
CREATE TRIGGER trg_vortex_rate_user_blocks BEFORE INSERT ON public.user_blocks
FOR EACH ROW EXECUTE FUNCTION public.enforce_vortex_write_rate_limit();

-- Atomic follow/unfollow preserves private-account pending requests and avoids
-- the client-side SELECT-then-INSERT race. The target profile row serializes
-- concurrent toggles for the same target account.
CREATE OR REPLACE FUNCTION public.toggle_follow(target_user_id UUID)
RETURNS TABLE(is_following BOOLEAN, is_pending BOOLEAN, followers_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_target_is_private BOOLEAN;
  v_existing_status TEXT;
  v_following BOOLEAN := FALSE;
  v_pending BOOLEAN := FALSE;
  v_followers_count INTEGER := 0;
BEGIN
  IF v_user_id IS NULL OR NOT public.is_account_active(v_user_id) THEN
    RAISE EXCEPTION 'An active authenticated account is required.' USING ERRCODE = '42501';
  END IF;
  IF target_user_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot follow your own account.' USING ERRCODE = '22023';
  END IF;

  SELECT profile_row.is_private
    INTO v_target_is_private
    FROM public.profiles AS profile_row
   WHERE profile_row.id = target_user_id
     AND public.is_account_active(profile_row.id)
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The account you are trying to follow does not exist or is unavailable.' USING ERRCODE = 'P0002';
  END IF;
  IF public.is_blocked_from(target_user_id) THEN
    RAISE EXCEPTION 'Follow is unavailable for this account.' USING ERRCODE = '42501';
  END IF;

  SELECT follow_row.status
    INTO v_existing_status
    FROM public.follows AS follow_row
   WHERE follow_row.follower_id = v_user_id
     AND follow_row.following_id = target_user_id
   FOR UPDATE;

  IF FOUND THEN
    DELETE FROM public.follows
     WHERE follower_id = v_user_id
       AND following_id = target_user_id;
  ELSE
    v_pending := COALESCE(v_target_is_private, FALSE);
    v_following := NOT v_pending;
    INSERT INTO public.follows (follower_id, following_id, status)
    VALUES (v_user_id, target_user_id, CASE WHEN v_pending THEN 'pending' ELSE 'accepted' END);
  END IF;

  SELECT profile_row.followers_count
    INTO v_followers_count
    FROM public.profiles AS profile_row
   WHERE profile_row.id = target_user_id;

  RETURN QUERY SELECT v_following, v_pending, COALESCE(v_followers_count, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.toggle_follow(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_follow(UUID) TO authenticated;

-- Server-side Following feed: the client no longer serializes hundreds of
-- followed user IDs into a large PostgREST .in(...) URL.
CREATE OR REPLACE FUNCTION public.get_following_feed(
  page_limit INTEGER DEFAULT 30,
  page_offset INTEGER DEFAULT 0,
  target_community_id UUID DEFAULT NULL
)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT post_row.*
    FROM public.posts AS post_row
   WHERE (post_row.author_id = auth.uid() OR EXISTS (
     SELECT 1
       FROM public.follows AS follow_row
      WHERE follow_row.follower_id = auth.uid()
        AND follow_row.following_id = post_row.author_id
        AND follow_row.status = 'accepted'
   ))
     AND (target_community_id IS NULL OR post_row.community_id = target_community_id)
   ORDER BY post_row.created_at DESC, post_row.id DESC
   LIMIT GREATEST(1, LEAST(COALESCE(page_limit, 30), 100))
   OFFSET GREATEST(0, COALESCE(page_offset, 0));
$function$;

REVOKE ALL ON FUNCTION public.get_following_feed(INTEGER, INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_following_feed(INTEGER, INTEGER, UUID) TO authenticated;

-- Time-decayed popularity prevents old high-like posts from permanently
-- dominating the For You feed. RLS remains the visibility boundary.
CREATE OR REPLACE FUNCTION public.get_for_you_feed(
  page_limit INTEGER DEFAULT 30,
  page_offset INTEGER DEFAULT 0,
  target_community_id UUID DEFAULT NULL
)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT post_row.*
    FROM public.posts AS post_row
   WHERE (target_community_id IS NULL OR post_row.community_id = target_community_id)
   ORDER BY (
     pg_catalog.ln(1.0::DOUBLE PRECISION + GREATEST(COALESCE(post_row.likes_count, 0), 0)::DOUBLE PRECISION)
     / pg_catalog.power(
         GREATEST(pg_catalog.date_part('epoch', pg_catalog.now() - post_row.created_at) / 3600.0, 0.0)::DOUBLE PRECISION + 2.0::DOUBLE PRECISION,
         0.65::DOUBLE PRECISION
       )
   ) DESC, post_row.created_at DESC, post_row.id DESC
   LIMIT GREATEST(1, LEAST(COALESCE(page_limit, 30), 100))
   OFFSET GREATEST(0, COALESCE(page_offset, 0));
$function$;

REVOKE ALL ON FUNCTION public.get_for_you_feed(INTEGER, INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_for_you_feed(INTEGER, INTEGER, UUID) TO authenticated;

-- Serialize toggles by locking the parent post row. This avoids two rapid
-- requests racing through a client-side SELECT-then-INSERT/DELETE sequence.
CREATE OR REPLACE FUNCTION public.toggle_post_like(target_post_id UUID)
RETURNS TABLE(is_liked BOOLEAN, likes_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_exists BOOLEAN;
BEGIN
  IF v_user_id IS NULL OR NOT public.is_account_active(v_user_id) THEN
    RAISE EXCEPTION 'An active authenticated account is required.' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.posts AS post_row
   WHERE post_row.id = target_post_id
     AND public.can_view_post(post_row.id)
     AND NOT public.is_blocked_from(post_row.author_id)
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Post is unavailable.' USING ERRCODE = 'P0002'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.post_likes WHERE post_id = target_post_id AND user_id = v_user_id)
    INTO v_exists;
  IF v_exists THEN
    DELETE FROM public.post_likes WHERE post_id = target_post_id AND user_id = v_user_id;
  ELSE
    INSERT INTO public.post_likes(post_id, user_id) VALUES (target_post_id, v_user_id);
  END IF;

  RETURN QUERY SELECT EXISTS (
    SELECT 1 FROM public.post_likes WHERE post_id = target_post_id AND user_id = v_user_id
  ), (SELECT post_row.likes_count FROM public.posts AS post_row WHERE post_row.id = target_post_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_post_repost(target_post_id UUID)
RETURNS TABLE(is_reposted BOOLEAN, reposts_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_exists BOOLEAN;
BEGIN
  IF v_user_id IS NULL OR NOT public.is_account_active(v_user_id) THEN
    RAISE EXCEPTION 'An active authenticated account is required.' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.posts AS post_row
   WHERE post_row.id = target_post_id
     AND public.can_view_post(post_row.id)
     AND NOT public.is_blocked_from(post_row.author_id)
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Post is unavailable.' USING ERRCODE = 'P0002'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.reposts WHERE post_id = target_post_id AND user_id = v_user_id)
    INTO v_exists;
  IF v_exists THEN
    DELETE FROM public.reposts WHERE post_id = target_post_id AND user_id = v_user_id;
  ELSE
    INSERT INTO public.reposts(post_id, user_id) VALUES (target_post_id, v_user_id);
  END IF;

  RETURN QUERY SELECT EXISTS (
    SELECT 1 FROM public.reposts WHERE post_id = target_post_id AND user_id = v_user_id
  ), (SELECT post_row.reposts_count FROM public.posts AS post_row WHERE post_row.id = target_post_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_post_bookmark(target_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_exists BOOLEAN;
BEGIN
  IF v_user_id IS NULL OR NOT public.is_account_active(v_user_id) THEN
    RAISE EXCEPTION 'An active authenticated account is required.' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.posts AS post_row
   WHERE post_row.id = target_post_id
     AND public.can_view_post(post_row.id)
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Post is unavailable.' USING ERRCODE = 'P0002'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.bookmarks WHERE post_id = target_post_id AND user_id = v_user_id)
    INTO v_exists;
  IF v_exists THEN
    DELETE FROM public.bookmarks WHERE post_id = target_post_id AND user_id = v_user_id;
    RETURN FALSE;
  END IF;
  INSERT INTO public.bookmarks(post_id, user_id) VALUES (target_post_id, v_user_id);
  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.toggle_post_like(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_post_repost(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_post_bookmark(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_post_like(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_post_repost(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_post_bookmark(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_vortex_write_rate_limit() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.validate_vortex_profile_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_privileged_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_post_managed_counters() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_profile_post_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_community_member_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_community_member_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_vortex_content_limits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_post_media_owner_path() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_story_media_owner_path() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_conversation_creation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_conversation_membership_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_vortex_write_rate_limit() FROM PUBLIC, anon, authenticated;
