-- ============================================================================
-- VORTEX — Notification automation
-- Migration: 20261118000006_notification_triggers.sql
-- Creates notifications for likes, comments, replies, follows, reposts,
-- direct/group messages, and community joins.
-- ============================================================================

-- Notification records need stable references for message/community navigation.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS conversation_id UUID
    REFERENCES public.conversations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS message_id UUID
    REFERENCES public.messages(id) ON DELETE CASCADE;

-- Replies are a distinct notification type; message/community already existed.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like', 'comment', 'reply', 'follow', 'repost', 'mention', 'community', 'message'));

CREATE INDEX IF NOT EXISTS idx_notifications_conversation_id
  ON public.notifications(conversation_id)
  WHERE conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_message_id
  ON public.notifications(message_id)
  WHERE message_id IS NOT NULL;

-- A repeated action must not create another row for the same actor/target.
-- In particular, unlike -> like does not duplicate an existing like notice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_post_action
  ON public.notifications(user_id, actor_id, type, post_id)
  WHERE post_id IS NOT NULL AND type IN ('like', 'repost');

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_follow_action
  ON public.notifications(user_id, actor_id, type)
  WHERE type = 'follow';

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_comment_action
  ON public.notifications(user_id, actor_id, type, comment_id)
  WHERE comment_id IS NOT NULL AND type IN ('comment', 'reply');

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_community_action
  ON public.notifications(user_id, actor_id, type, community_id)
  WHERE community_id IS NOT NULL AND type = 'community';

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_message_action
  ON public.notifications(user_id, actor_id, type, message_id)
  WHERE message_id IS NOT NULL AND type = 'message';

-- SECURITY DEFINER is required because notification inserts are intentionally
-- not available to clients through RLS. All values originate from row triggers.
CREATE OR REPLACE FUNCTION public.enqueue_vortex_notification(
  p_user_id UUID,
  p_actor_id UUID,
  p_type TEXT,
  p_post_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL,
  p_community_id UUID DEFAULT NULL,
  p_conversation_id UUID DEFAULT NULL,
  p_message_id UUID DEFAULT NULL,
  p_post_snippet TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_push_enabled BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_actor_id IS NULL OR p_user_id = p_actor_id THEN
    RETURN;
  END IF;

  IF p_type NOT IN ('like', 'comment', 'reply', 'follow', 'repost', 'community', 'message') THEN
    RAISE EXCEPTION 'Unsupported generated notification type: %', p_type
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(
    (SELECT settings.push_notifications
       FROM public.user_settings AS settings
      WHERE settings.user_id = p_user_id),
    TRUE
  )
  INTO v_push_enabled;

  IF v_push_enabled IS FALSE THEN
    RETURN;
  END IF;

  -- Suppress notifications in either direction when either account blocked
  -- the other. This also applies to group messages and community moderators.
  IF EXISTS (
    SELECT 1
      FROM public.user_blocks AS blocks
     WHERE (blocks.blocker_id = p_actor_id AND blocks.blocked_id = p_user_id)
        OR (blocks.blocker_id = p_user_id AND blocks.blocked_id = p_actor_id)
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    actor_id,
    type,
    post_id,
    comment_id,
    community_id,
    conversation_id,
    message_id,
    post_snippet,
    is_read,
    created_at
  ) VALUES (
    p_user_id,
    p_actor_id,
    p_type,
    p_post_id,
    p_comment_id,
    p_community_id,
    p_conversation_id,
    p_message_id,
    NULLIF(pg_catalog.left(COALESCE(p_post_snippet, ''), 240), ''),
    FALSE,
    pg_catalog.now()
  )
  ON CONFLICT DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION public.enqueue_vortex_notification(UUID, UUID, TEXT, UUID, UUID, UUID, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_vortex_notification(UUID, UUID, TEXT, UUID, UUID, UUID, UUID, UUID, TEXT) FROM anon, authenticated;

-- A like notifies the owner of the liked post.
CREATE OR REPLACE FUNCTION public.notify_vortex_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_author_id UUID;
  v_content TEXT;
BEGIN
  SELECT posts.author_id, posts.content
    INTO v_author_id, v_content
    FROM public.posts AS posts
   WHERE posts.id = NEW.post_id;

  PERFORM public.enqueue_vortex_notification(
    v_author_id, NEW.user_id, 'like', NEW.post_id,
    NULL, NULL, NULL, NULL, v_content
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_notification_post_like ON public.post_likes;
CREATE TRIGGER trg_vortex_notification_post_like
AFTER INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_vortex_post_like();

-- Top-level comments notify the post author. Replies notify the parent-comment
-- author, and also the post author when they are a different person.
CREATE OR REPLACE FUNCTION public.notify_vortex_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_post_author_id UUID;
  v_parent_author_id UUID;
BEGIN
  SELECT posts.author_id
    INTO v_post_author_id
    FROM public.posts AS posts
   WHERE posts.id = NEW.post_id;

  IF NEW.parent_comment_id IS NULL THEN
    PERFORM public.enqueue_vortex_notification(
      v_post_author_id, NEW.author_id, 'comment', NEW.post_id,
      NEW.id, NULL, NULL, NULL, NEW.content
    );
  ELSE
    SELECT comments.author_id
      INTO v_parent_author_id
      FROM public.comments AS comments
     WHERE comments.id = NEW.parent_comment_id;

    PERFORM public.enqueue_vortex_notification(
      v_parent_author_id, NEW.author_id, 'reply', NEW.post_id,
      NEW.id, NULL, NULL, NULL, NEW.content
    );

    IF v_post_author_id IS DISTINCT FROM v_parent_author_id THEN
      PERFORM public.enqueue_vortex_notification(
        v_post_author_id, NEW.author_id, 'comment', NEW.post_id,
        NEW.id, NULL, NULL, NULL, NEW.content
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_notification_comment ON public.comments;
CREATE TRIGGER trg_vortex_notification_comment
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.notify_vortex_comment();

-- Notify when a follow becomes accepted. Pending requests do not notify as
-- completed follows; a later transition to accepted does.
CREATE OR REPLACE FUNCTION public.notify_vortex_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status = 'accepted' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.enqueue_vortex_notification(
        NEW.following_id, NEW.follower_id, 'follow'
      );
    ELSIF OLD.status IS DISTINCT FROM 'accepted' THEN
      PERFORM public.enqueue_vortex_notification(
        NEW.following_id, NEW.follower_id, 'follow'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_notification_follow ON public.follows;
CREATE TRIGGER trg_vortex_notification_follow
AFTER INSERT OR UPDATE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.notify_vortex_follow();

-- A repost notifies the original post author.
CREATE OR REPLACE FUNCTION public.notify_vortex_repost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_author_id UUID;
  v_content TEXT;
BEGIN
  SELECT posts.author_id, posts.content
    INTO v_author_id, v_content
    FROM public.posts AS posts
   WHERE posts.id = NEW.post_id;

  PERFORM public.enqueue_vortex_notification(
    v_author_id, NEW.user_id, 'repost', NEW.post_id,
    NULL, NULL, NULL, NULL, v_content
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_notification_repost ON public.reposts;
CREATE TRIGGER trg_vortex_notification_repost
AFTER INSERT ON public.reposts
FOR EACH ROW EXECUTE FUNCTION public.notify_vortex_repost();

-- A new message notifies every other member of its conversation. The common
-- helper excludes self-notifications, disabled push settings, and blocked pairs.
CREATE OR REPLACE FUNCTION public.notify_vortex_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_member RECORD;
  v_snippet TEXT;
BEGIN
  v_snippet := COALESCE(NULLIF(NEW.content, ''), 'Shared an attachment');

  FOR v_member IN
    SELECT members.user_id
      FROM public.conversation_members AS members
     WHERE members.conversation_id = NEW.conversation_id
       AND members.user_id <> NEW.sender_id
  LOOP
    PERFORM public.enqueue_vortex_notification(
      v_member.user_id,
      NEW.sender_id,
      'message',
      NULL,
      NULL,
      NULL,
      NEW.conversation_id,
      NEW.id,
      v_snippet
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_notification_message ON public.messages;
CREATE TRIGGER trg_vortex_notification_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_vortex_message();

-- Notify community creators and current moderators/admins when a new member joins.
CREATE OR REPLACE FUNCTION public.notify_vortex_community_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_recipient_id UUID;
  v_community_name TEXT;
BEGIN
  SELECT communities.name
    INTO v_community_name
    FROM public.communities AS communities
   WHERE communities.id = NEW.community_id;

  FOR v_recipient_id IN
    SELECT communities.created_by
      FROM public.communities AS communities
     WHERE communities.id = NEW.community_id
       AND communities.created_by IS NOT NULL
    UNION
    SELECT members.user_id
      FROM public.community_members AS members
     WHERE members.community_id = NEW.community_id
       AND members.role IN ('admin', 'moderator')
  LOOP
    PERFORM public.enqueue_vortex_notification(
      v_recipient_id,
      NEW.user_id,
      'community',
      NULL,
      NULL,
      NEW.community_id,
      NULL,
      NULL,
      v_community_name
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_vortex_notification_community_join ON public.community_members;
CREATE TRIGGER trg_vortex_notification_community_join
AFTER INSERT ON public.community_members
FOR EACH ROW EXECUTE FUNCTION public.notify_vortex_community_join();

-- Extend immutability protection to the new message references.
CREATE OR REPLACE FUNCTION public.protect_notification_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.post_id IS DISTINCT FROM OLD.post_id
     OR NEW.comment_id IS DISTINCT FROM OLD.comment_id
     OR NEW.community_id IS DISTINCT FROM OLD.community_id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.message_id IS DISTINCT FROM OLD.message_id
     OR NEW.post_snippet IS DISTINCT FROM OLD.post_snippet
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Notification identity and content are immutable.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.enqueue_vortex_notification(UUID, UUID, TEXT, UUID, UUID, UUID, UUID, UUID, TEXT)
  IS 'Internal SECURITY DEFINER helper for privacy-aware, deduplicated VORTEX notifications.';
