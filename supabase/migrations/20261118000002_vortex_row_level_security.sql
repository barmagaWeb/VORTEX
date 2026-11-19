-- ====================================================================
-- VORTEX SOCIAL NETWORK — COMPLETE ROW LEVEL SECURITY POLICIES
-- Migration: 20261118000002_vortex_row_level_security.sql
-- ====================================================================

-- Enable RLS on all 22 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. PROFILES POLICIES
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (
        NOT is_suspended 
        OR auth.uid() = id 
        OR public.is_moderator()
    );

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        -- Regular users cannot promote their own role
        AND (role = (SELECT role FROM public.profiles WHERE id = auth.uid()) OR public.is_admin())
    );

-- 2. POSTS POLICIES
CREATE POLICY "Posts viewable according to visibility and blocks"
    ON public.posts FOR SELECT
    USING (
        -- Not blocked by author
        NOT EXISTS (
            SELECT 1 FROM public.user_blocks 
            WHERE blocker_id = posts.author_id AND blocked_id = auth.uid()
        )
        AND (
            visibility = 'public'
            OR author_id = auth.uid()
            OR (
                visibility = 'followers' 
                AND EXISTS (
                    SELECT 1 FROM public.follows 
                    WHERE follower_id = auth.uid() AND following_id = posts.author_id AND status = 'accepted'
                )
            )
            OR public.is_moderator()
        )
    );

CREATE POLICY "Authenticated users can create posts"
    ON public.posts FOR INSERT
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their own posts"
    ON public.posts FOR UPDATE
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors and Admins can delete posts"
    ON public.posts FOR DELETE
    USING (auth.uid() = author_id OR public.is_moderator());

-- 3. POST MEDIA POLICIES
CREATE POLICY "Media is viewable if parent post is viewable"
    ON public.post_media FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.posts WHERE id = post_media.post_id
        )
    );

CREATE POLICY "Author can insert media for their posts"
    ON public.post_media FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.posts WHERE id = post_media.post_id AND author_id = auth.uid()
        )
    );

CREATE POLICY "Author or Admin can delete media"
    ON public.post_media FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.posts WHERE id = post_media.post_id AND (author_id = auth.uid() OR public.is_moderator())
        )
    );

-- 4. COMMENTS POLICIES
CREATE POLICY "Comments viewable by anyone who can view the post"
    ON public.comments FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.posts WHERE id = comments.post_id)
    );

CREATE POLICY "Authenticated users can create comments"
    ON public.comments FOR INSERT
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Author can update comment"
    ON public.comments FOR UPDATE
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Author, Post Owner or Admin can delete comments"
    ON public.comments FOR DELETE
    USING (
        auth.uid() = author_id
        OR EXISTS (SELECT 1 FROM public.posts WHERE id = comments.post_id AND author_id = auth.uid())
        OR public.is_moderator()
    );

-- 5. LIKES & REPOSTS POLICIES
CREATE POLICY "Anyone can view likes"
    ON public.post_likes FOR SELECT
    USING (TRUE);

CREATE POLICY "Users can manage their own likes"
    ON public.post_likes FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view comment likes"
    ON public.comment_likes FOR SELECT
    USING (TRUE);

CREATE POLICY "Users can manage their own comment likes"
    ON public.comment_likes FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view reposts"
    ON public.reposts FOR SELECT
    USING (TRUE);

CREATE POLICY "Users can manage their own reposts"
    ON public.reposts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. BOOKMARKS POLICIES (Strictly Private to User)
CREATE POLICY "Users can only view and manage their own bookmarks"
    ON public.bookmarks FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 7. FOLLOWS POLICIES
CREATE POLICY "Anyone can view follow relations"
    ON public.follows FOR SELECT
    USING (TRUE);

CREATE POLICY "Users can manage their own followings"
    ON public.follows FOR ALL
    USING (auth.uid() = follower_id OR auth.uid() = following_id)
    WITH CHECK (auth.uid() = follower_id);

-- 8. CONVERSATIONS & MESSAGING POLICIES
CREATE POLICY "Users can only view conversations they belong to"
    ON public.conversations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members 
            WHERE conversation_id = conversations.id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Authenticated users can create conversations"
    ON public.conversations FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY "Conversation members can view membership"
    ON public.conversation_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members cm 
            WHERE cm.conversation_id = conversation_members.conversation_id AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Conversation members can view messages"
    ON public.messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members 
            WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Conversation members can send messages"
    ON public.messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM public.conversation_members 
            WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their message reads"
    ON public.message_reads FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 9. NOTIFICATIONS POLICIES
CREATE POLICY "Users can only view and manage their own notifications"
    ON public.notifications FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 10. COMMUNITIES POLICIES
CREATE POLICY "Communities viewable by all"
    ON public.communities FOR SELECT
    USING (TRUE);

CREATE POLICY "Authenticated users can create communities"
    ON public.communities FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Community creators, moderators or platform admins can update community"
    ON public.communities FOR UPDATE
    USING (
        auth.uid() = created_by 
        OR public.is_admin() 
        OR EXISTS (
            SELECT 1 FROM public.community_members 
            WHERE community_id = communities.id AND user_id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

CREATE POLICY "Anyone can view community members"
    ON public.community_members FOR SELECT
    USING (TRUE);

CREATE POLICY "Users can join or leave communities"
    ON public.community_members FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Community posts viewable"
    ON public.community_posts FOR SELECT
    USING (TRUE);

CREATE POLICY "Community members can post to community"
    ON public.community_posts FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.community_members 
            WHERE community_id = community_posts.community_id AND user_id = auth.uid()
        )
    );

-- 11. REPORTS & MODERATION POLICIES
CREATE POLICY "Users can view their own reports; Moderators can view all"
    ON public.reports FOR SELECT
    USING (auth.uid() = reported_by OR public.is_moderator());

CREATE POLICY "Authenticated users can submit reports"
    ON public.reports FOR INSERT
    WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Moderators can update reports"
    ON public.reports FOR UPDATE
    USING (public.is_moderator());

CREATE POLICY "Only moderators can view and create moderation actions"
    ON public.moderation_actions FOR ALL
    USING (public.is_moderator())
    WITH CHECK (public.is_moderator());

-- 12. ADMIN AUDIT LOGS (Immutable by users)
CREATE POLICY "Only admins can view audit logs"
    ON public.admin_audit_logs FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Only admins can insert audit logs"
    ON public.admin_audit_logs FOR INSERT
    WITH CHECK (public.is_admin());

-- 13. USER BLOCKS & SETTINGS POLICIES
CREATE POLICY "Users can manage their blocked accounts"
    ON public.user_blocks FOR ALL
    USING (auth.uid() = blocker_id)
    WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can manage their own settings"
    ON public.user_settings FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);