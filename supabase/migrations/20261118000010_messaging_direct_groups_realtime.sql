-- Atomic direct-chat creation, secure group operations, and Realtime publication.
-- All functions are SECURITY DEFINER with an empty search_path and qualified names.


CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at
  ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_read
  ON public.conversation_members (user_id, last_read_at DESC);

CREATE OR REPLACE FUNCTION public.vortex_touch_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.conversations
     SET updated_at = NEW.created_at
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_touch_conversation_on_message ON public.messages;
CREATE TRIGGER trg_vortex_touch_conversation_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.vortex_touch_conversation_on_message();

CREATE OR REPLACE FUNCTION public.vortex_get_or_create_direct_conversation(p_target_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_conversation_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_target_user_id IS NULL OR p_target_user_id = v_uid THEN
    RAISE EXCEPTION 'INVALID_CONVERSATION_TARGET' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'TARGET_USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF public.is_blocked_from(p_target_user_id) THEN
    RAISE EXCEPTION 'CONVERSATION_BLOCKED' USING ERRCODE = '42501';
  END IF;

  -- Serialize creation for this unordered user pair to avoid race-created DMs.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(
      LEAST(v_uid::TEXT, p_target_user_id::TEXT) || ':' ||
      GREATEST(v_uid::TEXT, p_target_user_id::TEXT)
    )
  );

  SELECT conversation_row.id
    INTO v_conversation_id
    FROM public.conversations AS conversation_row
   WHERE COALESCE(conversation_row.is_group, FALSE) = FALSE
     AND EXISTS (
       SELECT 1 FROM public.conversation_members AS mine
        WHERE mine.conversation_id = conversation_row.id AND mine.user_id = v_uid
     )
     AND EXISTS (
       SELECT 1 FROM public.conversation_members AS theirs
        WHERE theirs.conversation_id = conversation_row.id AND theirs.user_id = p_target_user_id
     )
     AND (
       SELECT pg_catalog.count(*)
         FROM public.conversation_members AS members
        WHERE members.conversation_id = conversation_row.id
     ) = 2
   ORDER BY conversation_row.created_at DESC
   LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO public.conversations (is_group, created_by)
  VALUES (FALSE, v_uid)
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (v_conversation_id, v_uid, 'admin'), (v_conversation_id, p_target_user_id, 'member');

  RETURN v_conversation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.vortex_create_group_conversation(
  p_group_name TEXT,
  p_member_ids UUID[] DEFAULT '{}'::UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_group_id UUID;
  v_name TEXT := pg_catalog.left(pg_catalog.btrim(COALESCE(p_group_name, '')), 80);
  v_members UUID[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF v_name = '' THEN RAISE EXCEPTION 'GROUP_NAME_REQUIRED' USING ERRCODE = '22023'; END IF;

  SELECT COALESCE(pg_catalog.array_agg(candidate), '{}'::UUID[])
    INTO v_members
    FROM (
      SELECT DISTINCT requested.member_id AS candidate
        FROM pg_catalog.unnest(COALESCE(p_member_ids, '{}'::UUID[])) AS requested(member_id)
       WHERE requested.member_id IS NOT NULL AND requested.member_id <> v_uid
    ) AS unique_members;

  IF pg_catalog.cardinality(v_members) > 49 THEN
    RAISE EXCEPTION 'GROUP_MEMBER_LIMIT_EXCEEDED' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.unnest(v_members) AS requested(user_id)
     WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = requested.user_id)
        OR public.is_blocked_from(requested.user_id)
  ) THEN
    RAISE EXCEPTION 'INVALID_OR_BLOCKED_GROUP_MEMBER' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.conversations (is_group, group_name, created_by)
  VALUES (TRUE, v_name, v_uid)
  RETURNING id INTO v_group_id;

  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (v_group_id, v_uid, 'admin');

  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  SELECT v_group_id, requested.user_id, 'member'
    FROM pg_catalog.unnest(v_members) AS requested(user_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN v_group_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.vortex_add_group_member(p_conversation_id UUID, p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.conversations AS conversation_row
   WHERE conversation_row.id = p_conversation_id AND conversation_row.is_group = TRUE
     AND (conversation_row.created_by = v_uid OR EXISTS (
       SELECT 1 FROM public.conversation_members AS admin_member
       WHERE admin_member.conversation_id = p_conversation_id
         AND admin_member.user_id = v_uid AND admin_member.role = 'admin'
     ))
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GROUP_ADMIN_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_member_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_member_id)
     OR public.is_blocked_from(p_member_id) THEN
    RAISE EXCEPTION 'INVALID_OR_BLOCKED_GROUP_MEMBER' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = p_conversation_id AND user_id = p_member_id)
     AND (SELECT pg_catalog.count(*) FROM public.conversation_members WHERE conversation_id = p_conversation_id) >= 50 THEN
    RAISE EXCEPTION 'GROUP_MEMBER_LIMIT_EXCEEDED' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (p_conversation_id, p_member_id, 'member')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.vortex_remove_group_member(p_conversation_id UUID, p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations AS conversation_row
    WHERE conversation_row.id = p_conversation_id AND conversation_row.is_group = TRUE
      AND (conversation_row.created_by = v_uid OR EXISTS (
        SELECT 1 FROM public.conversation_members AS admin_member
        WHERE admin_member.conversation_id = p_conversation_id
          AND admin_member.user_id = v_uid AND admin_member.role = 'admin'
      ))
  ) THEN RAISE EXCEPTION 'GROUP_ADMIN_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_member_id = (SELECT created_by FROM public.conversations WHERE id = p_conversation_id) THEN
    RAISE EXCEPTION 'GROUP_OWNER_CANNOT_BE_REMOVED' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.conversation_members
   WHERE conversation_id = p_conversation_id AND user_id = p_member_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.vortex_leave_group(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations AS conversation_row
    JOIN public.conversation_members AS member_row ON member_row.conversation_id = conversation_row.id
    WHERE conversation_row.id = p_conversation_id
      AND conversation_row.is_group = TRUE
      AND member_row.user_id = v_uid
  ) THEN RAISE EXCEPTION 'GROUP_MEMBERSHIP_NOT_FOUND' USING ERRCODE = '42501'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = p_conversation_id AND is_group = TRUE AND created_by = v_uid
  ) THEN RAISE EXCEPTION 'GROUP_OWNER_MUST_TRANSFER_OR_CLOSE_GROUP' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.conversation_members
   WHERE conversation_id = p_conversation_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'GROUP_MEMBERSHIP_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.vortex_rename_group(p_conversation_id UUID, p_group_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT := pg_catalog.left(pg_catalog.btrim(COALESCE(p_group_name, '')), 80);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF v_name = '' THEN RAISE EXCEPTION 'GROUP_NAME_REQUIRED' USING ERRCODE = '22023'; END IF;
  UPDATE public.conversations AS conversation_row
     SET group_name = v_name, updated_at = pg_catalog.now()
   WHERE conversation_row.id = p_conversation_id
     AND conversation_row.is_group = TRUE
     AND (conversation_row.created_by = v_uid OR EXISTS (
       SELECT 1 FROM public.conversation_members AS admin_member
       WHERE admin_member.conversation_id = p_conversation_id
         AND admin_member.user_id = v_uid AND admin_member.role = 'admin'
     ));
  IF NOT FOUND THEN RAISE EXCEPTION 'GROUP_ADMIN_REQUIRED' USING ERRCODE = '42501'; END IF;
END;
$function$;


CREATE OR REPLACE FUNCTION public.vortex_get_conversation_summaries()
RETURNS TABLE (
  conversation_id UUID,
  is_group BOOLEAN,
  group_name TEXT,
  group_avatar TEXT,
  owner_id UUID,
  other_user_id UUID,
  other_name TEXT,
  other_username TEXT,
  other_avatar TEXT,
  other_followers_count INTEGER,
  other_following_count INTEGER,
  other_posts_count INTEGER,
  other_joined_at TIMESTAMPTZ,
  other_role TEXT,
  last_message_id UUID,
  last_message_sender_id UUID,
  last_message_content TEXT,
  last_message_created_at TIMESTAMPTZ,
  last_message_attachments TEXT[],
  unread_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    conversation_row.id,
    COALESCE(conversation_row.is_group, FALSE),
    conversation_row.group_name,
    conversation_row.group_avatar,
    conversation_row.created_by,
    other_profile.id,
    other_profile.name,
    other_profile.username,
    other_profile.avatar,
    COALESCE(other_profile.followers_count, 0),
    COALESCE(other_profile.following_count, 0),
    COALESCE(other_profile.posts_count, 0),
    other_profile.created_at,
    other_profile.role::TEXT,
    last_message.id,
    last_message.sender_id,
    last_message.content,
    last_message.created_at,
    last_message.attachments,
    COALESCE(unread.messages_count, 0)
  FROM public.conversations AS conversation_row
  JOIN public.conversation_members AS own_membership
    ON own_membership.conversation_id = conversation_row.id
   AND own_membership.user_id = auth.uid()
  LEFT JOIN LATERAL (
    SELECT profile_row.*
    FROM public.conversation_members AS other_membership
    JOIN public.profiles AS profile_row ON profile_row.id = other_membership.user_id
    WHERE other_membership.conversation_id = conversation_row.id
      AND other_membership.user_id <> auth.uid()
    ORDER BY other_membership.joined_at ASC
    LIMIT 1
  ) AS other_profile ON TRUE
  LEFT JOIN LATERAL (
    SELECT message_row.id, message_row.sender_id, message_row.content,
           message_row.created_at, message_row.attachments
    FROM public.messages AS message_row
    WHERE message_row.conversation_id = conversation_row.id
    ORDER BY message_row.created_at DESC
    LIMIT 1
  ) AS last_message ON TRUE
  LEFT JOIN LATERAL (
    SELECT pg_catalog.count(*) AS messages_count
    FROM public.messages AS message_row
    WHERE message_row.conversation_id = conversation_row.id
      AND message_row.sender_id <> auth.uid()
      AND (own_membership.last_read_at IS NULL OR message_row.created_at > own_membership.last_read_at)
  ) AS unread ON TRUE
  WHERE public.can_access_conversation(conversation_row.id)
  ORDER BY COALESCE(last_message.created_at, conversation_row.created_at) DESC;
$function$;

CREATE OR REPLACE FUNCTION public.vortex_mark_conversation_read(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_previous_read_at TIMESTAMPTZ;
  v_read_at TIMESTAMPTZ := pg_catalog.now();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT public.can_access_conversation(p_conversation_id) THEN
    RAISE EXCEPTION 'CONVERSATION_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT last_read_at INTO v_previous_read_at
    FROM public.conversation_members
   WHERE conversation_id = p_conversation_id AND user_id = v_uid
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONVERSATION_MEMBERSHIP_NOT_FOUND' USING ERRCODE = '42501'; END IF;

  UPDATE public.conversation_members
     SET last_read_at = v_read_at
   WHERE conversation_id = p_conversation_id AND user_id = v_uid;

  INSERT INTO public.message_reads (message_id, user_id, read_at)
  SELECT message_row.id, v_uid, v_read_at
    FROM public.messages AS message_row
   WHERE message_row.conversation_id = p_conversation_id
     AND message_row.sender_id <> v_uid
     AND (v_previous_read_at IS NULL OR message_row.created_at > v_previous_read_at)
  ON CONFLICT (message_id, user_id)
  DO UPDATE SET read_at = EXCLUDED.read_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.vortex_touch_conversation_on_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vortex_get_or_create_direct_conversation(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vortex_get_conversation_summaries() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vortex_mark_conversation_read(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vortex_create_group_conversation(TEXT, UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vortex_add_group_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vortex_remove_group_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vortex_leave_group(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vortex_rename_group(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vortex_get_or_create_direct_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vortex_get_conversation_summaries() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vortex_mark_conversation_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vortex_create_group_conversation(TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vortex_add_group_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vortex_remove_group_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vortex_leave_group(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vortex_rename_group(UUID, TEXT) TO authenticated;

-- Supabase Realtime subscriptions are meaningful only when these tables are
-- also included in the realtime publication. Add entries idempotently.
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.post_media REPLICA IDENTITY FULL;
ALTER TABLE public.post_likes REPLICA IDENTITY FULL;
ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER TABLE public.reposts REPLICA IDENTITY FULL;
ALTER TABLE public.follows REPLICA IDENTITY FULL;
DO $publication$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'posts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'post_media'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.post_media;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'post_likes'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'comments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reposts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.reposts;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'follows'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
    END IF;
  END IF;
END;
$publication$;
