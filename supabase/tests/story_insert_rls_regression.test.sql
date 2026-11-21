-- Regression assertions for the story INSERT policy.
-- Run in a disposable Supabase branch/project; this test is read-only.
DO $$
DECLARE
  policy_row record;
BEGIN
  SELECT roles, with_check INTO policy_row
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'stories'
    AND policyname = 'Users create their own image stories';

  IF policy_row.roles IS NULL THEN
    RAISE EXCEPTION 'Story INSERT policy is missing';
  END IF;
  IF NOT ('authenticated' = ANY(policy_row.roles)) THEN
    RAISE EXCEPTION 'Story INSERT policy is not scoped to authenticated';
  END IF;
  IF policy_row.with_check NOT LIKE '%auth.uid() = user_id%'
     OR policy_row.with_check NOT LIKE '%media_type = ''image''%'
     OR policy_row.with_check NOT LIKE '%is_account_active%' THEN
    RAISE EXCEPTION 'Story INSERT policy is missing an ownership, media-type, or active-account check';
  END IF;
END $$;
