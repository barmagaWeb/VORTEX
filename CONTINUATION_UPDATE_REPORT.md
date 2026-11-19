# VORTEX — Continuation development and live database report

**Date:** 2026-11-19  
**Source archive:** `VORTEX_FIXED_COMPLETE(1).zip`  
**Hosted project:** `VORTEX` (`iseqhovvpnzppttcoqgr`)  
**Status:** Source improvements prepared; hosted index migration applied and verified; full production build remains blocked by package-registry DNS.

## Work completed in this continuation

### Frontend and settings

- Added `SupabaseSettingsService` for real `user_settings` reads and writes.
- Settings now load saved theme, language, email notification preference, push notification preference, and privacy state from the signed-in user's own row.
- Theme and language preferences can be saved to the database as well as the existing local preference storage.
- Replaced the hard-coded blocked-account examples with the signed-in user's real `user_blocks` records.
- Unblock now performs a real database delete and only updates the UI after the request succeeds.
- Removed the false UI claim that two-factor authentication is already enabled. The page now accurately states that 2FA controls are not configured.
- Stabilized theme and language setters with `useCallback` so settings hydration does not repeatedly refetch after provider rerenders.

### Admin panel and data correctness

- Removed fabricated `activeToday` and `serverHealth` values from the live Supabase metrics response. Those values now show as unavailable until actual telemetry is implemented.
- Removed hard-coded growth/concurrency captions that implied measured analytics.
- Admin data loading errors are surfaced instead of silently ignored.
- Report, account-suspension, and verification operations now check database errors and verify that a row was actually changed.
- Admin audit-log failures are surfaced instead of being silently discarded.
- Changed the moderation action label to “Mark Actioned”; the current action changes report status and records an audit event, but does not itself delete the reported content.

## Hosted database work

### Verified before changes

- Project status: `ACTIVE_HEALTHY`
- PostgreSQL: 17
- Public schema inventory: 29 application tables
- RLS: enabled on every public table
- Policies: 69
- Non-internal triggers: 47
- Public functions: 59
- Hosted migrations before this continuation: 8

### Tests performed safely with rollback

- Simulated an authenticated user's `posts` INSERT using the live RLS policies and `RETURNING`; it succeeded. The transaction was rolled back.
- Simulated an authenticated user's `user_settings` UPSERT; it succeeded. The transaction was rolled back.
- Confirmed the `user_settings` policy scopes reads and writes to `auth.uid() = user_id`.
- Confirmed test rows were not left behind; the live counts remained 1 profile, 1 post, and 1 user-settings row.

### Migration applied

Applied and recorded `20261119172646_vortex_fk_covering_indexes_20261119`, adding 23 covering indexes for foreign-key columns across active application tables.

Supabase Performance Advisor's `unindexed_foreign_keys` findings dropped from 24 to 1. The remaining finding belongs to the disabled legacy video-reel bookmarks table, which was intentionally left untouched.

## Remaining advisor findings

- 51 RLS `auth_rls_initplan` performance warnings remain; these need a carefully reviewed policy rewrite and regression testing.
- 23 authenticated `SECURITY DEFINER` functions and 2 safe helper functions callable by `anon` remain flagged. These were not blanket-revoked because several are intentional policy helpers and authenticated RPC endpoints; each requires call-site and authorization review.
- Leaked-password protection remains disabled in Supabase Auth and must be enabled in the Auth security settings.
- Four “RLS enabled, no policy” notices are on three disabled legacy tables and one private internal rate-limit table. These are intentionally inaccessible.
- The advisor lists unused indexes. No indexes were removed because the project currently has extremely low traffic and usage statistics are not sufficient grounds for destructive index cleanup.

## Validation

| Check | Result |
|---|---|
| TypeScript/TSX syntax parse | Passed: 85 files, zero parser diagnostics |
| EN/AR translation parity | Passed: 267 keys in each language |
| Live `posts` RLS insert test | Passed; rolled back |
| Live `user_settings` upsert test | Passed; rolled back |
| Foreign-key advisor | 24 findings before, 1 legacy finding after |
| Supabase health advisor | No findings |
| `npm ci --no-audit --no-fund` | Blocked by npm registry DNS `EAI_AGAIN`; timed out |
| `tsc --noEmit` | Blocked by missing `@types` packages because dependency installation did not complete |
| Vitest / Vite production build | Not run; dependencies are incomplete |
| Browser end-to-end tests | Not run |

A syntax parse is not a substitute for full type checking. The site is **not production-certified** until dependencies install successfully, typecheck/tests/build pass, and live browser workflows are exercised.

## Important deployment note

The hosted project has a custom migration history that differs from the baseline migration chain in the original ZIP. Keep the new index migration file in source control, but do not replay the original migrations against the live project. Reconcile all local and remote migration history before the next schema deployment.
