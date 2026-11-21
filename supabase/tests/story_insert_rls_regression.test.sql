-- pgTAP regression assertions for the story INSERT policy.
-- Run with supabase test db against a disposable/local database.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(5);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stories'
      AND policyname = 'Users create their own image stories'
  ),
  'story INSERT policy exists'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stories'
      AND policyname = 'Users create their own image stories'
      AND roles @> ARRAY['authenticated']::name[]
  ),
  'story INSERT policy is scoped to authenticated users'
);

SELECT ok(
  position('auth.uid()' IN coalesce((
    SELECT with_check FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stories'
      AND policyname = 'Users create their own image stories'
  ), '')) > 0
  AND position('user_id' IN coalesce((
    SELECT with_check FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stories'
      AND policyname = 'Users create their own image stories'
  ), '')) > 0,
  'story creation is bound to the authenticated user'
);

SELECT ok(
  position('media_type' IN coalesce((
    SELECT with_check FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stories'
      AND policyname = 'Users create their own image stories'
  ), '')) > 0
  AND position('image' IN coalesce((
    SELECT with_check FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stories'
      AND policyname = 'Users create their own image stories'
  ), '')) > 0,
  'story creation is restricted to images'
);

SELECT ok(
  position('is_account_active' IN coalesce((
    SELECT with_check FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stories'
      AND policyname = 'Users create their own image stories'
  ), '')) > 0,
  'suspended or missing accounts cannot create stories'
);

SELECT * FROM finish();
ROLLBACK;
