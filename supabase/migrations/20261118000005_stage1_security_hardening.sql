-- =============================================================================
-- VORTEX — STAGE 1 SECURITY HARDENING
-- Migration: 20261118000005_stage1_security_hardening.sql
--
-- This migration intentionally repairs the policies created in migrations
-- 20261118000002 and 20261118000004. Previous migrations remain unchanged.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Conversation ownership column must exist before helper functions reference it.
-- Keep the later backfill/default/index block below so existing memberships can
-- still determine the original conversation creator.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 1. Harden security-definer helpers. An empty search_path prevents objects in
--    an untrusted schema from shadowing referenced objects.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile_row
    WHERE profile_row.id = auth.uid()
      AND profile_row.role = 'admin'
      AND profile_row.is_suspended = FALSE
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile_row
    WHERE profile_row.id = auth.uid()
      AND profile_row.role IN ('admin', 'moderator')
      AND profile_row.is_suspended = FALSE
  );
$function$;

-- Returns true if the current user has blocked the target or is blocked by it.
CREATE OR REPLACE FUNCTION public.is_blocked_from(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL OR target_user_id IS NULL OR target_user_id = auth.uid()
      THEN FALSE
    ELSE EXISTS (
      SELECT 1
      FROM public.user_blocks AS block_row
      WHERE (block_row.blocker_id = auth.uid() AND block_row.blocked_id = target_user_id)
         OR (block_row.blocker_id = target_user_id AND block_row.blocked_id = auth.uid())
    )
  END;
$function$;

-- Centralized post visibility check. Private accounts require an accepted
-- follow even for posts whose individual visibility is public.
CREATE OR REPLACE FUNCTION public.can_view_post(target_post_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1
      FROM public.posts AS post_row
      INNER JOIN public.profiles AS author_row ON author_row.id = post_row.author_id
      WHERE post_row.id = target_post_id
        AND (
          post_row.author_id = auth.uid()
          OR (
            NOT public.is_blocked_from(post_row.author_id)
            AND author_row.is_suspended = FALSE
            AND (
              public.is_moderator()
              OR (
                post_row.visibility = 'public'
                AND (
                  author_row.is_private = FALSE
                  OR EXISTS (
                    SELECT 1
                    FROM public.follows AS follow_row
                    WHERE follow_row.follower_id = auth.uid()
                      AND follow_row.following_id = post_row.author_id
                      AND follow_row.status = 'accepted'
                  )
                )
              )
              OR (
                post_row.visibility = 'followers'
                AND EXISTS (
                  SELECT 1
                  FROM public.follows AS follow_row
                  WHERE follow_row.follower_id = auth.uid()
                    AND follow_row.following_id = post_row.author_id
                    AND follow_row.status = 'accepted'
                )
              )
            )
          )
        )
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.is_conversation_member(target_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.conversation_members AS member_row
    WHERE member_row.conversation_id = target_conversation_id
      AND member_row.user_id = auth.uid()
  );
$function$;

-- A conversation containing a user blocked in either direction is inaccessible
-- to the current user. This helper avoids recursive conversation_members RLS.
CREATE OR REPLACE FUNCTION public.can_access_conversation(target_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.conversation_members AS self_member
      WHERE self_member.conversation_id = target_conversation_id
        AND self_member.user_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.conversation_members AS other_member
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
    AND EXISTS (
      SELECT 1
      FROM public.conversations AS conversation_row
      WHERE conversation_row.id = target_conversation_id
        AND conversation_row.created_by = auth.uid()
    )
    AND (
      target_user_id = auth.uid()
      OR NOT public.is_blocked_from(target_user_id)
    );
$function$;

-- Visibility helpers for the objects introduced in migration 0004.
CREATE OR REPLACE FUNCTION public.can_view_story(target_story_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.stories AS story_row
    INNER JOIN public.profiles AS owner_row ON owner_row.id = story_row.user_id
    WHERE story_row.id = target_story_id
      AND story_row.expires_at > now()
      AND owner_row.is_suspended = FALSE
      AND (
        story_row.user_id = auth.uid()
        OR (
          NOT public.is_blocked_from(story_row.user_id)
          AND (
            owner_row.is_private = FALSE
            OR EXISTS (
              SELECT 1
              FROM public.follows AS follow_row
              WHERE follow_row.follower_id = auth.uid()
                AND follow_row.following_id = story_row.user_id
                AND follow_row.status = 'accepted'
            )
          )
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_view_reel(target_reel_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.reels AS reel_row
    INNER JOIN public.profiles AS owner_row ON owner_row.id = reel_row.user_id
    WHERE reel_row.id = target_reel_id
      AND owner_row.is_suspended = FALSE
      AND (
        reel_row.user_id = auth.uid()
        OR (
          NOT public.is_blocked_from(reel_row.user_id)
          AND (
            owner_row.is_private = FALSE
            OR EXISTS (
              SELECT 1
              FROM public.follows AS follow_row
              WHERE follow_row.follower_id = auth.uid()
                AND follow_row.following_id = reel_row.user_id
                AND follow_row.status = 'accepted'
            )
          )
        )
      )
  );
$function$;

-- -----------------------------------------------------------------------------
-- 2. Database-side protection against self-promotion and client-side edits to
--    server-managed profile fields.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Only an administrator can change account roles.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.verified IS DISTINCT FROM OLD.verified
       OR NEW.is_suspended IS DISTINCT FROM OLD.is_suspended THEN
      RAISE EXCEPTION 'Only an administrator can change verification or suspension state.'
        USING ERRCODE = '42501';
    END IF;

    IF (
      NEW.followers_count IS DISTINCT FROM OLD.followers_count
      OR NEW.following_count IS DISTINCT FROM OLD.following_count
      OR NEW.posts_count IS DISTINCT FROM OLD.posts_count
    ) AND COALESCE(
      current_setting('vortex.trusted_profile_counter_update', TRUE),
      'off'
    ) <> 'on' THEN
      RAISE EXCEPTION 'Profile counters can only be changed by trusted database operations.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privileged_fields();

-- -----------------------------------------------------------------------------
-- 3. Conversation ownership. The existing client creates a conversation and
--    adds its participants in a second request, so the owner is recorded here.
-- -----------------------------------------------------------------------------

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.conversations AS conversation_row
SET created_by = (
  SELECT member_row.user_id
  FROM public.conversation_members AS member_row
  WHERE member_row.conversation_id = conversation_row.id
  ORDER BY member_row.joined_at ASC, member_row.user_id ASC
  LIMIT 1
)
WHERE conversation_row.created_by IS NULL;

ALTER TABLE public.conversations
  ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_conversations_created_by
  ON public.conversations(created_by);

CREATE OR REPLACE FUNCTION public.protect_conversation_member_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Conversation membership identity cannot be changed.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can change conversation member roles.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_conversation_member_privileged_fields
  ON public.conversation_members;
CREATE TRIGGER trg_protect_conversation_member_privileged_fields
BEFORE UPDATE ON public.conversation_members
FOR EACH ROW
EXECUTE FUNCTION public.protect_conversation_member_privileged_fields();

CREATE OR REPLACE FUNCTION public.protect_conversation_member_insert_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.role <> 'member'
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin()
     AND NOT EXISTS (
       SELECT 1
       FROM public.conversations AS conversation_row
       WHERE conversation_row.id = NEW.conversation_id
         AND conversation_row.created_by = auth.uid()
     ) THEN
    RAISE EXCEPTION 'Only the conversation creator or a platform administrator can assign elevated member roles.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_conversation_member_insert_role
  ON public.conversation_members;
CREATE TRIGGER trg_protect_conversation_member_insert_role
BEFORE INSERT ON public.conversation_members
FOR EACH ROW
EXECUTE FUNCTION public.protect_conversation_member_insert_role();

-- A follower cannot mark their own request as accepted for a private account.
CREATE OR REPLACE FUNCTION public.enforce_private_follow_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  target_is_private BOOLEAN;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.follower_id <> auth.uid() THEN
        RAISE EXCEPTION 'Users can create only their own follow request.'
          USING ERRCODE = '42501';
      END IF;

      SELECT profile_row.is_private
      INTO target_is_private
      FROM public.profiles AS profile_row
      WHERE profile_row.id = NEW.following_id;

      IF COALESCE(target_is_private, FALSE) THEN
        NEW.status := 'pending';
      ELSE
        NEW.status := 'accepted';
      END IF;
    ELSE
      IF NEW.follower_id IS DISTINCT FROM OLD.follower_id
         OR NEW.following_id IS DISTINCT FROM OLD.following_id THEN
        RAISE EXCEPTION 'Follow relationship identity cannot be changed.'
          USING ERRCODE = '42501';
      END IF;

      IF NOT (
        NEW.following_id = auth.uid()
        AND OLD.status = 'pending'
        AND NEW.status = 'accepted'
      ) THEN
        RAISE EXCEPTION 'Only the followed account can accept a pending follow request.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_private_follow_requests ON public.follows;
CREATE TRIGGER trg_enforce_private_follow_requests
BEFORE INSERT OR UPDATE OF follower_id, following_id, status ON public.follows
FOR EACH ROW
EXECUTE FUNCTION public.enforce_private_follow_requests();

-- Pending requests do not inflate follower/following counts. Counts are updated
-- only when a relationship becomes accepted (including private-account approval).
CREATE OR REPLACE FUNCTION public.handle_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM set_config('vortex.trusted_profile_counter_update', 'on', TRUE);

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'accepted' THEN
      UPDATE public.profiles
      SET following_count = following_count + 1
      WHERE id = NEW.follower_id;

      UPDATE public.profiles
      SET followers_count = followers_count + 1
      WHERE id = NEW.following_id;
    END IF;
    PERFORM set_config('vortex.trusted_profile_counter_update', 'off', TRUE);
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'accepted' THEN
      UPDATE public.profiles
      SET following_count = GREATEST(0, following_count - 1)
      WHERE id = OLD.follower_id;

      UPDATE public.profiles
      SET followers_count = GREATEST(0, followers_count - 1)
      WHERE id = OLD.following_id;
    END IF;
    PERFORM set_config('vortex.trusted_profile_counter_update', 'off', TRUE);
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
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

  PERFORM set_config('vortex.trusted_profile_counter_update', 'off', TRUE);
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_follow_counts ON public.follows;
CREATE TRIGGER trg_follow_counts
AFTER INSERT OR DELETE OR UPDATE OF status ON public.follows
FOR EACH ROW
EXECUTE FUNCTION public.handle_follow_counts();

-- -----------------------------------------------------------------------------
-- 4. Replace permissive/unsafe policies from migration 0002.
-- -----------------------------------------------------------------------------

-- Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Profiles are visible unless suspended or blocked"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR (
      is_suspended = FALSE
      AND NOT public.is_blocked_from(id)
    )
    OR public.is_moderator()
  );

CREATE POLICY "Users update their own profile and admins update any profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- Posts
DROP POLICY IF EXISTS "Posts viewable according to visibility and blocks" ON public.posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Authors can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Authors and Admins can delete posts" ON public.posts;

CREATE POLICY "Posts visible only through centralized access check"
  ON public.posts FOR SELECT
  USING (public.can_view_post(id));

CREATE POLICY "Users create posts for themselves"
  ON public.posts FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles AS profile_row
      WHERE profile_row.id = auth.uid()
        AND profile_row.is_suspended = TRUE
    )
  );

CREATE POLICY "Authors update their own posts"
  ON public.posts FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors and moderators delete posts"
  ON public.posts FOR DELETE
  USING (auth.uid() = author_id OR public.is_moderator());

-- Post media inherits the visibility of its parent post.
DROP POLICY IF EXISTS "Media is viewable if parent post is viewable" ON public.post_media;
DROP POLICY IF EXISTS "Author can insert media for their posts" ON public.post_media;
DROP POLICY IF EXISTS "Author or Admin can delete media" ON public.post_media;

CREATE POLICY "Post media visible with parent post"
  ON public.post_media FOR SELECT
  USING (public.can_view_post(post_id));

CREATE POLICY "Authors add media to their own posts"
  ON public.post_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts AS post_row
      WHERE post_row.id = post_id
        AND post_row.author_id = auth.uid()
    )
  );

CREATE POLICY "Authors and moderators delete post media"
  ON public.post_media FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.posts AS post_row
      WHERE post_row.id = post_id
        AND (post_row.author_id = auth.uid() OR public.is_moderator())
    )
  );

-- Comments and replies
DROP POLICY IF EXISTS "Comments viewable by anyone who can view the post" ON public.comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
DROP POLICY IF EXISTS "Author can update comment" ON public.comments;
DROP POLICY IF EXISTS "Author, Post Owner or Admin can delete comments" ON public.comments;

CREATE POLICY "Comments visible with post and block permissions"
  ON public.comments FOR SELECT
  USING (
    public.can_view_post(post_id)
    AND (author_id = auth.uid() OR NOT public.is_blocked_from(author_id))
  );

CREATE POLICY "Users comment only where interaction is allowed"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND public.can_view_post(post_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.posts AS post_row
      WHERE post_row.id = post_id
        AND public.is_blocked_from(post_row.author_id)
    )
    AND (
      parent_comment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.comments AS parent_row
        WHERE parent_row.id = parent_comment_id
          AND parent_row.post_id = post_id
          AND NOT public.is_blocked_from(parent_row.author_id)
      )
    )
  );

CREATE POLICY "Authors update their own visible comments"
  ON public.comments FOR UPDATE
  USING (auth.uid() = author_id AND public.can_view_post(post_id))
  WITH CHECK (auth.uid() = author_id AND public.can_view_post(post_id));

CREATE POLICY "Authors post owners and moderators delete comments"
  ON public.comments FOR DELETE
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.posts AS post_row
      WHERE post_row.id = post_id AND post_row.author_id = auth.uid()
    )
    OR public.is_moderator()
  );

-- Post likes
DROP POLICY IF EXISTS "Anyone can view likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can manage their own likes" ON public.post_likes;

CREATE POLICY "Post likes visible only with accessible post"
  ON public.post_likes FOR SELECT
  USING (
    public.can_view_post(post_id)
    AND (user_id = auth.uid() OR NOT public.is_blocked_from(user_id))
  );

CREATE POLICY "Users like accessible posts when not blocked"
  ON public.post_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_view_post(post_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.posts AS post_row
      WHERE post_row.id = post_id
        AND public.is_blocked_from(post_row.author_id)
    )
  );

CREATE POLICY "Users remove their own post likes"
  ON public.post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Comment likes
DROP POLICY IF EXISTS "Anyone can view comment likes" ON public.comment_likes;
DROP POLICY IF EXISTS "Users can manage their own comment likes" ON public.comment_likes;

CREATE POLICY "Comment likes visible with accessible comment"
  ON public.comment_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.comments AS comment_row
      WHERE comment_row.id = comment_id
        AND public.can_view_post(comment_row.post_id)
        AND (
          comment_row.author_id = auth.uid()
          OR NOT public.is_blocked_from(comment_row.author_id)
        )
    )
    AND (user_id = auth.uid() OR NOT public.is_blocked_from(user_id))
  );

CREATE POLICY "Users like accessible comments when not blocked"
  ON public.comment_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.comments AS comment_row
      WHERE comment_row.id = comment_id
        AND public.can_view_post(comment_row.post_id)
        AND NOT public.is_blocked_from(comment_row.author_id)
    )
  );

CREATE POLICY "Users remove their own comment likes"
  ON public.comment_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Reposts
DROP POLICY IF EXISTS "Anyone can view reposts" ON public.reposts;
DROP POLICY IF EXISTS "Users can manage their own reposts" ON public.reposts;

CREATE POLICY "Reposts visible only with accessible post"
  ON public.reposts FOR SELECT
  USING (
    public.can_view_post(post_id)
    AND (user_id = auth.uid() OR NOT public.is_blocked_from(user_id))
  );

CREATE POLICY "Users repost accessible posts when not blocked"
  ON public.reposts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_view_post(post_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.posts AS post_row
      WHERE post_row.id = post_id
        AND public.is_blocked_from(post_row.author_id)
    )
  );

CREATE POLICY "Users remove their own reposts"
  ON public.reposts FOR DELETE
  USING (auth.uid() = user_id);

-- Follows
DROP POLICY IF EXISTS "Anyone can view follow relations" ON public.follows;
DROP POLICY IF EXISTS "Users can manage their own followings" ON public.follows;

CREATE POLICY "Follow relations hidden across blocked accounts"
  ON public.follows FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND NOT public.is_blocked_from(follower_id)
    AND NOT public.is_blocked_from(following_id)
  );

CREATE POLICY "Users follow accounts only when not blocked"
  ON public.follows FOR INSERT
  WITH CHECK (
    auth.uid() = follower_id
    AND follower_id <> following_id
    AND NOT public.is_blocked_from(following_id)
  );

CREATE POLICY "Users accept pending follow requests for their account"
  ON public.follows FOR UPDATE
  USING (
    auth.uid() = following_id
    AND status = 'pending'
    AND NOT public.is_blocked_from(follower_id)
  )
  WITH CHECK (
    auth.uid() = following_id
    AND status = 'accepted'
    AND NOT public.is_blocked_from(follower_id)
  );

CREATE POLICY "Users unfollow or reject pending requests"
  ON public.follows FOR DELETE
  USING (
    auth.uid() = follower_id
    OR (auth.uid() = following_id AND status = 'pending')
  );

-- -----------------------------------------------------------------------------
-- 5. Conversation and message isolation. These policies no longer query
--    conversation_members from a policy on that same table; all checks go via
--    SECURITY DEFINER helpers to avoid recursive RLS evaluation.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can only view conversations they belong to" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

CREATE POLICY "Members can view only accessible conversations"
  ON public.conversations FOR SELECT
  USING (public.can_access_conversation(id));

CREATE POLICY "Users create conversations as their owner"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

DROP POLICY IF EXISTS "Conversation members can view membership" ON public.conversation_members;
DROP POLICY IF EXISTS "Conversation members can insert membership" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can manage conversation membership" ON public.conversation_members;

CREATE POLICY "Members view membership in their accessible conversations"
  ON public.conversation_members FOR SELECT
  USING (public.can_access_conversation(conversation_id));

CREATE POLICY "Conversation creator adds members without blocked relationships"
  ON public.conversation_members FOR INSERT
  WITH CHECK (public.can_add_conversation_member(conversation_id, user_id));

CREATE POLICY "Members update only their own accessible membership"
  ON public.conversation_members FOR UPDATE
  USING (auth.uid() = user_id AND public.can_access_conversation(conversation_id))
  WITH CHECK (auth.uid() = user_id AND public.can_access_conversation(conversation_id));

CREATE POLICY "Members leave and creators remove memberships"
  ON public.conversation_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.conversations AS conversation_row
      WHERE conversation_row.id = conversation_id
        AND conversation_row.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Conversation members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Conversation members can send messages" ON public.messages;

CREATE POLICY "Messages visible only to accessible conversation members"
  ON public.messages FOR SELECT
  USING (public.can_access_conversation(conversation_id));

CREATE POLICY "Users send messages only in accessible conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.can_access_conversation(conversation_id)
  );

-- Message read receipts are visible only inside their conversation and can
-- only be written or changed by the user whose read receipt it is.
DROP POLICY IF EXISTS "Users can manage their message reads" ON public.message_reads;

CREATE POLICY "Conversation members view read receipts"
  ON public.message_reads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages AS message_row
      WHERE message_row.id = message_id
        AND public.can_access_conversation(message_row.conversation_id)
    )
  );

CREATE POLICY "Users create their own read receipts"
  ON public.message_reads FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.messages AS message_row
      WHERE message_row.id = message_id
        AND public.can_access_conversation(message_row.conversation_id)
    )
  );

CREATE POLICY "Users update their own read receipts"
  ON public.message_reads FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.messages AS message_row
      WHERE message_row.id = message_id
        AND public.can_access_conversation(message_row.conversation_id)
    )
  );

CREATE POLICY "Users delete their own read receipts"
  ON public.message_reads FOR DELETE
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 6. Notifications, blocks, and administrative records.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can only view and manage their own notifications" ON public.notifications;

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
     OR NEW.post_snippet IS DISTINCT FROM OLD.post_snippet
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Notification identity and content are immutable.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_notification_identity ON public.notifications;
CREATE TRIGGER trg_protect_notification_identity
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.protect_notification_identity();

CREATE POLICY "Users read their own notifications from accessible actors"
  ON public.notifications FOR SELECT
  USING (
    auth.uid() = user_id
    AND (actor_id = auth.uid() OR NOT public.is_blocked_from(actor_id))
  );

CREATE POLICY "Users mark their own notifications as read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their blocked accounts" ON public.user_blocks;

CREATE POLICY "Users read their own blocked accounts"
  ON public.user_blocks FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users block other accounts"
  ON public.user_blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id AND blocker_id <> blocked_id);

CREATE POLICY "Users unblock their own blocked accounts"
  ON public.user_blocks FOR DELETE
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can manage their own settings" ON public.user_settings;

CREATE POLICY "Users manage only their own settings"
  ON public.user_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Prevent users from granting themselves moderator/admin status in a community.
DROP POLICY IF EXISTS "Anyone can view community members" ON public.community_members;
DROP POLICY IF EXISTS "Users can join or leave communities" ON public.community_members;

CREATE POLICY "Community members are viewable"
  ON public.community_members FOR SELECT
  USING (TRUE);

CREATE POLICY "Users join communities with permitted membership role"
  ON public.community_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.communities AS community_row
      WHERE community_row.id = community_id
        AND public.is_blocked_from(community_row.created_by)
    )
    AND (
      role = 'member'
      OR public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.communities AS community_row
        WHERE community_row.id = community_id
          AND community_row.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Users leave communities and creators remove members"
  ON public.community_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.communities AS community_row
      WHERE community_row.id = community_id
        AND community_row.created_by = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 7. Review migration 0004: stories, story views, reels and their interactions
--    must respect private accounts and bilateral blocks.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Stories are viewable by authenticated users" ON public.stories;
DROP POLICY IF EXISTS "Users can create stories" ON public.stories;
DROP POLICY IF EXISTS "Users or admins can delete stories" ON public.stories;

CREATE POLICY "Stories visible to permitted viewers only"
  ON public.stories FOR SELECT
  USING (public.can_view_story(id));

CREATE POLICY "Users create their own stories"
  ON public.stories FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles AS profile_row
      WHERE profile_row.id = auth.uid()
        AND profile_row.is_suspended = TRUE
    )
  );

CREATE POLICY "Story owners and moderators delete stories"
  ON public.stories FOR DELETE
  USING (auth.uid() = user_id OR public.is_moderator());

DROP POLICY IF EXISTS "Users can view story views" ON public.story_views;
DROP POLICY IF EXISTS "Users can record their view" ON public.story_views;

CREATE POLICY "Story owners viewers and moderators view story receipts"
  ON public.story_views FOR SELECT
  USING (
    auth.uid() = viewer_id
    OR EXISTS (
      SELECT 1 FROM public.stories AS story_row
      WHERE story_row.id = story_id
        AND story_row.user_id = auth.uid()
    )
    OR public.is_moderator()
  );

CREATE POLICY "Users record views only for accessible stories"
  ON public.story_views FOR INSERT
  WITH CHECK (auth.uid() = viewer_id AND public.can_view_story(story_id));

DROP POLICY IF EXISTS "Reels are viewable by all authenticated users" ON public.reels;
DROP POLICY IF EXISTS "Users can create reels" ON public.reels;
DROP POLICY IF EXISTS "Users or admins can delete reels" ON public.reels;

CREATE POLICY "Reels visible to permitted viewers only"
  ON public.reels FOR SELECT
  USING (public.can_view_reel(id));

CREATE POLICY "Users create their own reels"
  ON public.reels FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles AS profile_row
      WHERE profile_row.id = auth.uid()
        AND profile_row.is_suspended = TRUE
    )
  );

CREATE POLICY "Reel owners and moderators delete reels"
  ON public.reels FOR DELETE
  USING (auth.uid() = user_id OR public.is_moderator());

DROP POLICY IF EXISTS "Reel likes viewable by authenticated" ON public.reel_likes;
DROP POLICY IF EXISTS "Users can toggle their like" ON public.reel_likes;
DROP POLICY IF EXISTS "Users can remove their like" ON public.reel_likes;

CREATE POLICY "Reel likes visible with accessible reel"
  ON public.reel_likes FOR SELECT
  USING (
    public.can_view_reel(reel_id)
    AND (user_id = auth.uid() OR NOT public.is_blocked_from(user_id))
  );

CREATE POLICY "Users like accessible reels when not blocked"
  ON public.reel_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_view_reel(reel_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.reels AS reel_row
      WHERE reel_row.id = reel_id
        AND public.is_blocked_from(reel_row.user_id)
    )
  );

CREATE POLICY "Users remove their own reel likes"
  ON public.reel_likes FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Post hashtags are viewable by everyone" ON public.post_hashtags;

CREATE POLICY "Post hashtags visible only with accessible post"
  ON public.post_hashtags FOR SELECT
  USING (public.can_view_post(post_id));

-- -----------------------------------------------------------------------------
-- 8. Keep helper function execution available to Postgres roles used by RLS.
--    Helpers accept only the current auth context (except the harmless id input).
-- -----------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_moderator() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked_from(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_post(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_conversation(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_add_conversation_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_story(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_reel(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.can_view_post(UUID) IS
  'Authoritative RLS predicate for post visibility, private profiles, follows, suspensions, and bilateral blocks.';
COMMENT ON FUNCTION public.can_access_conversation(UUID) IS
  'Authoritative RLS predicate for conversation membership and bilateral blocks; avoids recursive RLS.';
COMMENT ON COLUMN public.conversations.created_by IS
  'Authenticated user who created the conversation; used to authorize participant insertion.';
