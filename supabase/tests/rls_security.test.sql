-- Real PostgreSQL RLS tests for `supabase test db` (pgTAP).
-- These run under authenticated/anon Postgres roles and distinct JWT subject claims.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(10);

-- Fixtures are inserted as the migration/test owner, then every assertion below
-- switches to a real Supabase role and a distinct auth.uid() claim.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-a@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"username":"rls_user_a","name":"RLS User A"}', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-b@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"username":"rls_user_b","name":"RLS User B"}', now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'rls-admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"username":"rls_admin","name":"RLS Admin"}', now(), now())
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles SET role = 'admin' WHERE id = '10000000-0000-4000-8000-000000000003';

INSERT INTO public.posts (id, author_id, content, visibility)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'private post owned by A', 'private'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'post owned by A for community ownership test', 'public')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bookmarks (user_id, post_id)
VALUES ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO public.conversations (id, is_group, created_by)
VALUES ('30000000-0000-4000-8000-000000000001', FALSE, '10000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.conversation_members (conversation_id, user_id)
VALUES
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;
INSERT INTO public.messages (id, conversation_id, sender_id, content)
VALUES ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'RLS fixture message')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notifications (id, user_id, actor_id, type, post_id, post_snippet)
VALUES ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'like', '20000000-0000-4000-8000-000000000002', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.communities (id, name, slug, description, created_by)
VALUES ('60000000-0000-4000-8000-000000000001', 'RLS Test Community', 'rls-test-community', 'RLS fixture', '10000000-0000-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.community_members (community_id, user_id, role)
VALUES ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'member')
ON CONFLICT DO NOTHING;

-- 1: B cannot read A's private post.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', TRUE);
SELECT is((SELECT count(*)::INT FROM public.posts WHERE id = '20000000-0000-4000-8000-000000000001'), 0, 'user B cannot read user A private post');

-- 2: A can read their own private post.
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', TRUE);
SELECT is((SELECT count(*)::INT FROM public.posts WHERE id = '20000000-0000-4000-8000-000000000001'), 1, 'user A can read their own private post');

-- 3: B cannot read A's notifications.
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', TRUE);
SELECT is((SELECT count(*)::INT FROM public.notifications WHERE id = '50000000-0000-4000-8000-000000000001'), 0, 'user B cannot read user A notifications');

-- 4: admin who is not a conversation member cannot read the A/B message.
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', TRUE);
SELECT is((SELECT count(*)::INT FROM public.messages WHERE id = '40000000-0000-4000-8000-000000000001'), 0, 'non-member admin cannot read private conversation messages');

-- 5: A cannot read B's bookmarks.
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', TRUE);
SELECT is((SELECT count(*)::INT FROM public.bookmarks WHERE user_id = '10000000-0000-4000-8000-000000000002'), 0, 'bookmarks are isolated by owner');

-- 6: B cannot promote their own account.
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', TRUE);
SELECT throws_ok(
  $$UPDATE public.profiles SET role = 'admin' WHERE id = '10000000-0000-4000-8000-000000000002'$$,
  '42501',
  'Only an administrator can change role, verification or suspension state.',
  'user B cannot promote their own role'
);

-- 7: normal user cannot read the platform audit log.
SELECT is((SELECT count(*)::INT FROM public.admin_audit_logs), 0, 'normal user cannot read admin audit logs');

-- 8: platform admin can read an audit entry.
RESET ROLE;
INSERT INTO public.admin_audit_logs (admin_id, admin_name, action, target)
VALUES ('10000000-0000-4000-8000-000000000003', 'RLS Admin', 'fixture', 'rls-test')
ON CONFLICT DO NOTHING;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', TRUE);
SELECT ok((SELECT count(*) FROM public.admin_audit_logs) >= 1, 'admin can read admin audit logs');

-- 9: B cannot link A's post to a community even though B is a member.
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', TRUE);
SELECT throws_ok(
  $$INSERT INTO public.community_posts (community_id, post_id) VALUES ('60000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')$$,
  '42501',
  NULL,
  'community member cannot attach another author post'
);

-- 10: anonymous clients cannot call the post visibility helper as an RPC.
RESET ROLE;
SELECT ok(
  NOT has_function_privilege('anon', 'public.can_view_post(uuid)', 'EXECUTE'),
  'anonymous role cannot execute can_view_post helper'
);

SELECT * FROM finish();
ROLLBACK;
