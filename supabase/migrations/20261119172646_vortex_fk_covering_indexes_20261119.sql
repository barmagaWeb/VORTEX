-- VORTEX: cover foreign-key columns flagged by Supabase Performance Advisor.
-- Safe additive migration: creates indexes only; does not alter or delete application data.
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_post_id ON public.bookmarks (post_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON public.comment_likes (comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON public.comments (author_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id ON public.comments (parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_communities_created_by ON public.communities (created_by);
CREATE INDEX IF NOT EXISTS idx_community_members_user_id ON public.community_members (user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_post_id ON public.community_posts (post_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user_id ON public.message_reads (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_moderator_id ON public.moderation_actions (moderator_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_report_id ON public.moderation_actions (report_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON public.notifications (actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_comment_id ON public.notifications (comment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_community_id ON public.notifications (community_id);
CREATE INDEX IF NOT EXISTS idx_notifications_post_id ON public.notifications (post_id);
CREATE INDEX IF NOT EXISTS idx_post_hashtags_hashtag_id ON public.post_hashtags (hashtag_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON public.post_media (post_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_by ON public.reports (reported_by);
CREATE INDEX IF NOT EXISTS idx_reports_resolved_by ON public.reports (resolved_by);
CREATE INDEX IF NOT EXISTS idx_reposts_post_id ON public.reposts (post_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id ON public.user_blocks (blocked_id);
