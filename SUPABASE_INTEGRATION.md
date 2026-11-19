# VORTEX — Supabase Integration Guide

**Integration status: partially implemented; not production-certified.** The repository contains Supabase client services and twelve ordered migrations. This guide describes the expected setup; it is not evidence that the migrations or live services passed in this delivery.

## 1. Required environment variables

Create `.env` from `.env.example` and set:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_APP_URL=http://localhost:5173
VITE_ENV=development
```

Use only the public anon/publishable key in the browser. Never put a Supabase `service_role` key in browser code, a `VITE_*` variable, or a committed file. For production set `VITE_ENV=production` and provide valid HTTPS URL/key values. The client also checks `import.meta.env.PROD`; a production build cannot bypass the configuration guard by setting `VITE_ENV=development`.

## 2. Apply the database migrations

Apply the following files in ascending order. Do not edit migrations that have already been applied; add a new numbered migration for future changes.

1. `supabase/migrations/20261118000001_vortex_core_schema.sql`
2. `supabase/migrations/20261118000002_vortex_row_level_security.sql`
3. `supabase/migrations/20261118000003_vortex_storage_buckets.sql`
4. `supabase/migrations/20261118000004_stories_reels.sql` — historical migration retained unchanged; Reels are disabled by migration 9.
5. `supabase/migrations/20261118000005_stage1_security_hardening.sql`
6. `supabase/migrations/20261118000006_notification_triggers.sql`
7. `supabase/migrations/20261118000007_notification_reliability_and_storage.sql`
8. `supabase/migrations/20261118000008_security_storage_community_hashtags.sql`
9. `supabase/migrations/20261118000009_image_only_decommission_reels.sql` — revokes access to old Reel tables, preserves historic rows under legacy names, restricts media types to images, and updates bucket MIME allowlists.
10. `supabase/migrations/20261118000010_messaging_direct_groups_realtime.sql` — adds atomic direct-conversation lookup/creation, group operations, conversation summaries/read receipts, message timestamp maintenance, and Realtime publication entries.
11. `supabase/migrations/20261118000011_private_image_story_storage.sql` — creates the private `story_media` bucket and image-only Story policies.
12. `supabase/migrations/20261118000012_vortex_integrity_performance_hardening.sql` — adds case-insensitive username uniqueness, profile/content validation, managed counters, private media ownership checks, active-account checks for interactions, per-action write limits, trigram/feed indexes, time-decayed For You ranking, and atomic follow/like/repost/bookmark RPCs.

For Dashboard setup, open **SQL Editor** and execute each entire migration file in the order above, reviewing each result before continuing. Never run the local reset command against production.

For local setup, after installing/configuring the Supabase CLI and Docker:

```bash
supabase start
supabase db reset
supabase test db
```

These commands have not been run in the delivery environment. The SQL files are source changes only until they have been applied and tested against a local Supabase database. Migration 12 is required before the updated client calls `get_following_feed`, `get_for_you_feed`, `toggle_follow`, `toggle_post_like`, `toggle_post_repost`, and `toggle_post_bookmark`.

**Existing projects:** do not reset production and do not manually re-run migrations that are already recorded as applied. If migrations 1–11 are already recorded, apply only the new migration 12 through the normal Supabase migration workflow. The edits to migration 5 and 8 in this archive fix clean-install ordering/definition issues; already-applied migration files are not re-executed by Supabase, and migration 12 re-establishes the corrected follow-counter function for existing databases. If migration history is incomplete or inconsistent, inspect `supabase_migrations.schema_migrations` and take a backup before changing it.

## 3. Authentication

In Supabase Dashboard → Authentication → URL Configuration:

- Set Site URL to the deployed VORTEX origin.
- Add `http://localhost:5173` to Redirect URLs for development.
- Add the deployed origin and the verification/password-reset callback paths used by the application.
- Configure reliable SMTP before relying on confirmation and password-reset emails in production.

Test registration, email verification, resend, sign-in, and password reset with separate real test inboxes. Do not assign Admin by username, email, or mutable client profile data. The current security migrations include database-side role protection, but that does not replace a live authorization test.

## 4. Storage and image-only media

- `post_media` is private; objects are signable only when referenced by a visible post.
- `attachments` is private; objects are readable/signable only when referenced by a message in a conversation the viewer can access.
- `story_media` is private; objects are readable only when referenced by an active, visible image Story.
- User-owned uploads use the authenticated user's UUID as the first path segment.
- The application currently allows JPEG, PNG, WebP, and GIF uploads. The client checks the file signature as defense in depth and the buckets restrict declared MIME types.
- Signed URLs are generated when data is mapped for display and currently expire after one hour; refetch data when an open page has expired media URLs.

The client-side signature check is not a substitute for a trusted server-side image decoder/re-encoder. A malicious client can bypass browser validation and call Storage directly. Server-side file-content validation, malware scanning, EXIF stripping, and image re-encoding remain production hardening work.

Some existing user profile/community fields can still contain externally hosted HTTPS image URLs. Supabase Storage RLS does not control access to those third-party URLs.

## 5. Realtime

The current application subscribes to message inserts for the open conversation, notifications for the signed-in user, and new `posts` inserts for the feed. New-feed events show a manual refresh affordance instead of refetching for every interaction. A low-frequency message refresh is retained as a recovery path while the Realtime socket is unavailable. Migration 10 adds these tables to the `supabase_realtime` publication when that publication exists.

Typing indicators, online/offline Presence, connection health UI, and a unified retry manager are not implemented.

## 6. Tests and production gaps

`supabase/tests/rls_security.test.sql` contains pgTAP checks, but they have not been executed against the current twelve migrations in this delivery. Run:

```bash
supabase start
supabase db reset
supabase test db
```

Then verify with two independent authenticated accounts, including attempts to read messages, profiles, posts, and private Storage objects belonging to the other account.

Remaining gaps include global Arabic-aware full-text search/normalization, complete cursor pagination, message edit/delete and pagination beyond the latest 100 items, full notification deep links, social friend requests beyond the existing follow model, broader moderation UX, server-side media decoding/re-encoding, account export/deletion, Playwright E2E, CI, monitoring, and deployment-header compatibility testing. Migration 12 adds initial database-side write rate limits and static-host security headers, but those controls still require live verification and operational tuning.
