-- Structural regression checks for migrations 12 and 13. The behavioral attack cases
-- remain in rls_security.test.sql and must be run against Supabase's Postgres.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(20);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_profiles_username_lower_unique'),
  'case-insensitive username uniqueness index exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_posts_content_trgm'),
  'post search trigram index exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_posts_author_feed'),
  'following-feed author index exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.profiles'::regclass AND tgname = 'trg_protect_profile_privileged_fields' AND NOT tgisinternal),
  'profile privilege guard trigger exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.posts'::regclass AND tgname = 'trg_protect_post_managed_counters' AND NOT tgisinternal),
  'post counter guard trigger exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.community_members'::regclass AND tgname = 'trg_vortex_community_member_count' AND NOT tgisinternal),
  'community member count trigger exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.messages'::regclass AND tgname = 'trg_vortex_message_content_limits' AND NOT tgisinternal),
  'message content and attachment limit trigger exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.post_media'::regclass AND tgname = 'trg_vortex_post_media_owner_path' AND NOT tgisinternal),
  'post media owner-path trigger exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.posts'::regclass AND tgname = 'trg_vortex_rate_posts' AND NOT tgisinternal),
  'post write-rate limit trigger exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.post_likes'::regclass AND tgname = 'trg_vortex_rate_post_likes' AND NOT tgisinternal),
  'post-like write-rate limit trigger exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'story_views'
          AND policyname = 'Users record views only for accessible stories'
          AND COALESCE(with_check, '') LIKE '%is_account_active%'),
  'suspended accounts cannot record story views'
);
SELECT ok(to_regprocedure('public.get_following_feed(integer,integer,uuid)') IS NOT NULL, 'following feed RPC exists');
SELECT ok(to_regprocedure('public.get_for_you_feed(integer,integer,uuid)') IS NOT NULL, 'time-decayed For You feed RPC exists');
SELECT ok(to_regprocedure('public.toggle_follow(uuid)') IS NOT NULL, 'atomic follow RPC exists');
SELECT ok(to_regprocedure('public.toggle_post_like(uuid)') IS NOT NULL, 'atomic like RPC exists');
SELECT ok(to_regprocedure('public.toggle_post_repost(uuid)') IS NOT NULL AND to_regprocedure('public.toggle_post_bookmark(uuid)') IS NOT NULL, 'atomic repost and bookmark RPCs exist');


SELECT ok(
  EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.post_media'::regclass AND tgname = 'trg_vortex_post_media_count_limit' AND NOT tgisinternal),
  'post media count limit trigger exists'
);
SELECT ok(
  pg_catalog.pg_get_functiondef('public.get_for_you_feed(integer,integer,uuid)'::regprocedure) LIKE '%LIMIT 2000%',
  'For You ranking is bounded to 2,000 candidates'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
     WHERE tgrelid = 'public.post_media'::regclass
       AND tgname = 'trg_vortex_post_media_owner_and_type_guard'
       AND NOT tgisinternal
       AND (tgtype & 16) = 16
  ),
  'post media move/type updates are guarded'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
     WHERE tgrelid = 'public.post_media'::regclass
       AND tgname = 'trg_vortex_post_media_count_limit'
       AND NOT tgisinternal
       AND (tgtype & 1) = 0
       AND (tgtype & 2) = 0
       AND (tgtype & 4) = 4
  ),
  'post media count is checked once after each insert statement'
);

SELECT * FROM finish();
ROLLBACK;
