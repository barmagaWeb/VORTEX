-- ==============================================================================
-- VORTEX SOCIAL NETWORK — STORIES, REELS & HASHTAGS MIGRATION
-- Migration: 20261118000004_stories_reels.sql
-- ==============================================================================

-- 1. STORIES TABLE
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  views_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_stories_user ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON public.stories(expires_at);

-- 2. STORY VIEWS TABLE
CREATE TABLE IF NOT EXISTS public.story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_story ON public.story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_viewer ON public.story_views(viewer_id);

-- Trigger to increment views_count on public.stories
CREATE OR REPLACE FUNCTION public.handle_new_story_view()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.stories
  SET views_count = views_count + 1
  WHERE id = NEW.story_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_increment_story_view
AFTER INSERT ON public.story_views
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_story_view();

-- 3. REELS TABLE
CREATE TABLE IF NOT EXISTS public.reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  caption TEXT NOT NULL,
  music_title TEXT,
  tags TEXT[] DEFAULT '{}',
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  shares_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reels_user ON public.reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_created ON public.reels(created_at DESC);

-- 4. REEL LIKES TABLE
CREATE TABLE IF NOT EXISTS public.reel_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reel_likes_reel ON public.reel_likes(reel_id);
CREATE INDEX IF NOT EXISTS idx_reel_likes_user ON public.reel_likes(user_id);

-- Trigger to count reel likes
CREATE OR REPLACE FUNCTION public.handle_reel_like_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET likes_count = likes_count + 1 WHERE id = NEW.reel_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.reel_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_reel_likes_count
AFTER INSERT OR DELETE ON public.reel_likes
FOR EACH ROW
EXECUTE FUNCTION public.handle_reel_like_counts();

-- 5. REEL BOOKMARKS TABLE
CREATE TABLE IF NOT EXISTS public.reel_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reel_id, user_id)
);

-- 6. HASHTAGS TABLE
CREATE TABLE IF NOT EXISTS public.hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  posts_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hashtags_name ON public.hashtags(name);

CREATE TABLE IF NOT EXISTS public.post_hashtags (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, hashtag_id)
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;

-- Stories Policies:
-- Anyone authenticated can view active unexpired stories
CREATE POLICY "Stories are viewable by authenticated users"
ON public.stories FOR SELECT
USING (auth.role() = 'authenticated' AND expires_at > now());

-- Users can insert their own stories
CREATE POLICY "Users can create stories"
ON public.stories FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users or admins can delete stories
CREATE POLICY "Users or admins can delete stories"
ON public.stories FOR DELETE
USING (auth.uid() = user_id OR public.is_admin());

-- Story Views Policies:
CREATE POLICY "Users can view story views"
ON public.story_views FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can record their view"
ON public.story_views FOR INSERT
WITH CHECK (auth.uid() = viewer_id);

-- Reels Policies:
CREATE POLICY "Reels are viewable by all authenticated users"
ON public.reels FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create reels"
ON public.reels FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users or admins can delete reels"
ON public.reels FOR DELETE
USING (auth.uid() = user_id OR public.is_admin());

-- Reel Likes:
CREATE POLICY "Reel likes viewable by authenticated"
ON public.reel_likes FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can toggle their like"
ON public.reel_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their like"
ON public.reel_likes FOR DELETE
USING (auth.uid() = user_id);

-- Reel Bookmarks:
CREATE POLICY "Users view own reel bookmarks"
ON public.reel_bookmarks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users add reel bookmarks"
ON public.reel_bookmarks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove reel bookmarks"
ON public.reel_bookmarks FOR DELETE
USING (auth.uid() = user_id);

-- Hashtags:
CREATE POLICY "Hashtags are viewable by everyone"
ON public.hashtags FOR SELECT
USING (true);

CREATE POLICY "Post hashtags are viewable by everyone"
ON public.post_hashtags FOR SELECT
USING (true);
