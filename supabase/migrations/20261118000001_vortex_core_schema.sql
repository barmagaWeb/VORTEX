-- ====================================================================
-- VORTEX SOCIAL NETWORK — CORE PRODUCTION DATABASE SCHEMA
-- Migration: 20261118000001_vortex_core_schema.sql
-- Description: Core 22 tables, constraints, indexes, triggers, and functions
-- ====================================================================

-- 1. PROFILES (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    cover_image TEXT DEFAULT 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80',
    bio TEXT DEFAULT '',
    location TEXT DEFAULT '',
    website TEXT DEFAULT '',
    verified BOOLEAN DEFAULT FALSE,
    is_private BOOLEAN DEFAULT FALSE,
    is_suspended BOOLEAN DEFAULT FALSE,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 2. COMMUNITIES
CREATE TABLE IF NOT EXISTS public.communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'Technology' NOT NULL,
    avatar TEXT,
    cover_image TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    member_count INTEGER DEFAULT 1,
    rules JSONB DEFAULT '[]'::JSONB,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 3. POSTS
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    feeling TEXT,
    tags TEXT[] DEFAULT '{}'::TEXT[],
    visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'private')),
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    reposts_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 4. POST MEDIA (Images / Videos)
CREATE TABLE IF NOT EXISTS public.post_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
    aspect_ratio NUMERIC DEFAULT 1.0,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 5. COMMENTS
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 6. COMMENT LIKES
CREATE TABLE IF NOT EXISTS public.comment_likes (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    PRIMARY KEY (user_id, comment_id)
);

-- 7. POST LIKES
CREATE TABLE IF NOT EXISTS public.post_likes (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    PRIMARY KEY (user_id, post_id)
);

-- 8. REPOSTS
CREATE TABLE IF NOT EXISTS public.reposts (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    PRIMARY KEY (user_id, post_id)
);

-- 9. BOOKMARKS
CREATE TABLE IF NOT EXISTS public.bookmarks (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    PRIMARY KEY (user_id, post_id)
);

-- 10. FOLLOWS
CREATE TABLE IF NOT EXISTS public.follows (
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'accepted' CHECK (status IN ('accepted', 'pending')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    PRIMARY KEY (follower_id, following_id)
);

-- 11. CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_group BOOLEAN DEFAULT FALSE,
    group_name TEXT,
    group_avatar TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 12. CONVERSATION MEMBERS
CREATE TABLE IF NOT EXISTS public.conversation_members (
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    joined_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    last_read_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (conversation_id, user_id)
);

-- 13. MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    attachments TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 14. MESSAGE READS
CREATE TABLE IF NOT EXISTS public.message_reads (
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    PRIMARY KEY (message_id, user_id)
);

-- 15. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'repost', 'mention', 'community', 'message')),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
    post_snippet TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 16. COMMUNITY MEMBERS
CREATE TABLE IF NOT EXISTS public.community_members (
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
    joined_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    PRIMARY KEY (community_id, user_id)
);

-- 17. COMMUNITY POSTS
CREATE TABLE IF NOT EXISTS public.community_posts (
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    is_pinned BOOLEAN DEFAULT FALSE,
    added_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    PRIMARY KEY (community_id, post_id)
);

-- 18. REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_item_type TEXT NOT NULL CHECK (reported_item_type IN ('post', 'user', 'comment', 'community')),
    reported_item_id TEXT NOT NULL,
    reported_item_snippet TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 19. MODERATION ACTIONS
CREATE TABLE IF NOT EXISTS public.moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
    moderator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_taken TEXT NOT NULL,
    target_id TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 20. ADMIN AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    admin_name TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'warning', 'danger')),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 21. USER BLOCKS
CREATE TABLE IF NOT EXISTS public.user_blocks (
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    PRIMARY KEY (blocker_id, blocked_id)
);

-- 22. USER SETTINGS
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
    language TEXT DEFAULT 'en' CHECK (language IN ('en', 'ar')),
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    is_private BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- ====================================================================
-- PERFORMANCE INDEXES
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_community_id ON public.posts(community_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- ====================================================================
-- TRIGGERS & AUTOMATION FUNCTIONS
-- ====================================================================

-- Function: Create Profile & Settings on User Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, name, avatar)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || SUBSTRING(NEW.id::TEXT, 1, 8)),
        COALESCE(NEW.raw_user_meta_data->>'name', 'VORTEX Pioneer'),
        COALESCE(NEW.raw_user_meta_data->>'avatar', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80')
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: Update Post Counter Triggers (Likes, Comments, Reposts)
CREATE OR REPLACE FUNCTION public.handle_post_counters()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (TG_TABLE_NAME = 'post_likes') THEN
            UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
        ELSIF (TG_TABLE_NAME = 'comments') THEN
            UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
        ELSIF (TG_TABLE_NAME = 'reposts') THEN
            UPDATE public.posts SET reposts_count = reposts_count + 1 WHERE id = NEW.post_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (TG_TABLE_NAME = 'post_likes') THEN
            UPDATE public.posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
        ELSIF (TG_TABLE_NAME = 'comments') THEN
            UPDATE public.posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
        ELSIF (TG_TABLE_NAME = 'reposts') THEN
            UPDATE public.posts SET reposts_count = GREATEST(0, reposts_count - 1) WHERE id = OLD.post_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_post_likes_count
    AFTER INSERT OR DELETE ON public.post_likes
    FOR EACH ROW EXECUTE FUNCTION public.handle_post_counters();

CREATE OR REPLACE TRIGGER trg_comments_count
    AFTER INSERT OR DELETE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.handle_post_counters();

CREATE OR REPLACE TRIGGER trg_reposts_count
    AFTER INSERT OR DELETE ON public.reposts
    FOR EACH ROW EXECUTE FUNCTION public.handle_post_counters();

-- Function: Update Follower / Following Counts
CREATE OR REPLACE FUNCTION public.handle_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
        UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
        UPDATE public.profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_follow_counts
    AFTER INSERT OR DELETE ON public.follows
    FOR EACH ROW EXECUTE FUNCTION public.handle_follow_counts();
