-- VORTEX corrective migration 7
-- Keeps in-app notifications independent from push preferences, aggregates
-- unread message notices per conversation/recipient, and makes trigger failures
-- non-fatal to the user's original write.

-- The UI inbox is not a push channel. push_notifications must not suppress
-- persisted in-app notifications.
DROP INDEX IF EXISTS public.uq_notifications_message_action;

-- Collapse any existing unread message-notification duplicates before adding
-- the conversation-level uniqueness guarantee.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, conversation_id
           ORDER BY created_at DESC, id DESC
         ) AS position
    FROM public.notifications
   WHERE type = 'message'
     AND is_read = FALSE
     AND conversation_id IS NOT NULL
)
DELETE FROM public.notifications AS notifications
 USING ranked
 WHERE notifications.id = ranked.id
   AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_unread_message_conversation
  ON public.notifications(user_id, conversation_id)
  WHERE type = 'message' AND is_read = FALSE AND conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON public.notifications(user_id, created_at DESC);

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
BEGIN
  IF p_user_id IS NULL OR p_actor_id IS NULL OR p_user_id = p_actor_id THEN
    RETURN;
  END IF;

  IF p_type NOT IN ('like', 'comment', 'reply', 'follow', 'repost', 'community', 'message') THEN
    RAISE EXCEPTION 'Unsupported generated notification type: %', p_type
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.user_blocks AS blocks
     WHERE (blocks.blocker_id = p_actor_id AND blocks.blocked_id = p_user_id)
        OR (blocks.blocker_id = p_user_id AND blocks.blocked_id = p_actor_id)
  ) THEN
    RETURN;
  END IF;

  IF p_type = 'message' AND p_conversation_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id, actor_id, type, conversation_id, message_id,
      post_snippet, is_read, created_at
    ) VALUES (
      p_user_id, p_actor_id, 'message', p_conversation_id, p_message_id,
      NULL, FALSE, pg_catalog.now()
    )
    ON CONFLICT (user_id, conversation_id)
      WHERE type = 'message' AND is_read = FALSE AND conversation_id IS NOT NULL
    DO UPDATE SET
      actor_id = EXCLUDED.actor_id,
      message_id = EXCLUDED.message_id,
      post_snippet = NULL,
      created_at = EXCLUDED.created_at;
  ELSE
    INSERT INTO public.notifications (
      user_id, actor_id, type, post_id, comment_id, community_id,
      conversation_id, message_id, post_snippet, is_read, created_at
    ) VALUES (
      p_user_id, p_actor_id, p_type, p_post_id, p_comment_id, p_community_id,
      p_conversation_id, p_message_id,
      CASE WHEN p_type = 'message' THEN NULL
           ELSE NULLIF(pg_catalog.left(COALESCE(p_post_snippet, ''), 240), '') END,
      FALSE, pg_catalog.now()
    )
    ON CONFLICT DO NOTHING;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Notification failure must never roll back the originating social action.
    RAISE WARNING 'VORTEX notification enqueue failed (type=% recipient=%): %',
      p_type, p_user_id, SQLERRM;
    RETURN;
END;
$function$;

-- Pending follow requests also need to notify private-account owners. A later
-- transition to accepted is harmless because the unique follow index prevents
-- duplicate rows for the same actor/recipient pair.
CREATE OR REPLACE FUNCTION public.notify_vortex_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.enqueue_vortex_notification(
      NEW.following_id, NEW.follower_id, 'follow'
    );
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'accepted' THEN
    PERFORM public.enqueue_vortex_notification(
      NEW.following_id, NEW.follower_id, 'follow'
    );
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'VORTEX follow notification trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- Do not persist message text or a hard-coded English attachment phrase in
-- notification rows. The client can render a localized generic description.
CREATE OR REPLACE FUNCTION public.notify_vortex_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_member RECORD;
BEGIN
  FOR v_member IN
    SELECT members.user_id
      FROM public.conversation_members AS members
     WHERE members.conversation_id = NEW.conversation_id
       AND members.user_id <> NEW.sender_id
  LOOP
    PERFORM public.enqueue_vortex_notification(
      v_member.user_id, NEW.sender_id, 'message',
      NULL, NULL, NULL, NEW.conversation_id, NEW.id, NULL
    );
  END LOOP;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'VORTEX message notification trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- Keep bucket privacy explicit. This migration intentionally does not make
-- post_media private until post-media records and signed-URL refresh are wired
-- end-to-end; simply flipping the bucket would break existing media URLs.
COMMENT ON TABLE public.notifications IS
  'In-app notification inbox. push_notifications controls external push delivery only.';
