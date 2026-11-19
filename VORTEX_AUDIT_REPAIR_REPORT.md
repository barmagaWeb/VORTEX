# VORTEX — Audit & Repair Report

## Delivery status

**Partially repaired; not certified production-ready.** The archive was inspected and a concrete PostgREST relationship ambiguity was fixed in the actual source service. Runtime/database verification could not be completed in this environment. Do not treat this ZIP as proof that the remote Supabase project is repaired.

## Archive and architecture inventory

- Extracted archive: 150 files.
- Application: React 18 + TypeScript + Vite + React Router.
- Backend client: `@supabase/supabase-js`.
- Service registry: `src/services/index.ts` wires Auth, User, Post, Messaging, Notification, Community, Admin, and Stories services to Supabase implementations.
- UI: `src/pages/` and `src/components/`.
- Service layer: `src/services/supabase/`, interfaces under `src/services/interfaces/`, mock adapters under `src/services/mock/`.
- Shared state: `src/context/`.
- Database: timestamped SQL migrations under `supabase/migrations/`; SQL checks under `supabase/tests/`.
- Unit tests: `src/test/`.

## Dependency map

```text
src/main.tsx
  └─ src/app/App.tsx
      ├─ contexts: Auth / Toast / Theme / Language
      └─ src/app/router.tsx
          └─ pages/*
              └─ components/*
                  └─ src/services/index.ts
                      ├─ services/supabase/*
                      │   └─ services/supabase/client.ts
                      └─ interfaces/*
supabase/migrations/*
  └─ PostgreSQL schema, constraints, functions, triggers, RLS and storage
supabase/tests/*
  └─ database-level security/integrity checks
```

## Repairs applied

### 1. Ambiguous posts ↔ communities embed

**Root cause:** `posts` has a direct `community_id` foreign key to `communities`, while `community_posts` also creates a second relationship path between the same tables. Generic embeds such as `communities(id, name)` leave PostgREST unable to choose the intended relationship.

**Change:** In all six post-selection paths in `src/services/supabase/SupabasePostService.ts`, changed the embed to explicitly target the direct FK:

```ts
communities:communities!posts_community_id_fkey(id, name)
```

This preserves the domain property name (`communities`) while selecting the intended `posts.community_id → communities.id` relationship.

### 2. Environment-file hygiene

- Removed the included `.env` from the delivery archive. The app's publishable Supabase key is not a service-role secret, but environment-specific credentials/configuration should not be shipped as a tracked project file.
- Kept `.env.example`.
- Confirmed `.gitignore` already excludes `.env` and `.env.*`, while allowing `.env.example`.

### 3. Stray duplicate source artifact

- Removed the root-level `SupabasePostService.fixed.ts` duplicate. It was not the service imported by the application and its relative imports were not rooted at `src/services/supabase/`.
- Preserved the pre-repair production service in `_backup_before_repair/src/services/supabase/SupabasePostService.ts`.

## Supabase findings and limits

### `toggle_follow`

The migration defines `public.toggle_follow(target_user_id UUID)` and grants execution to `authenticated`. The TypeScript caller uses:

```ts
supabase.rpc('toggle_follow', { target_user_id: targetUserId })
```

The parameter name and UUID argument shape match. The SQL function also rejects unauthenticated/inactive users, self-follow, unavailable accounts, and blocked relationships; it locks the target profile row before toggling and relies on the follow table's uniqueness constraint for duplicate prevention.

**Not verified:** whether migration 12 is actually applied to the connected Supabase project, whether PostgREST's schema cache is current, and whether runtime calls succeed. The archive's migration file is not evidence of remote application.

### Posts 403

The supplied RLS migration contains an authenticated INSERT policy requiring `auth.uid() = author_id`, plus SELECT rules that allow authors to read their own posts. The schema also contains managed-counter protections and later security hardening.

**Not diagnosed conclusively:** a live 403 can also result from missing table grants, unapplied migrations, JWT/session state, policy interactions, or trigger rejection. No remote database introspection was possible, so no RLS policy was weakened or replaced speculatively.

### Feed relationships

The direct community FK name was confirmed in the supplied schema's `posts.community_id REFERENCES public.communities(id)` definition; PostgreSQL's generated constraint name is `posts_community_id_fkey` unless the live database has been customized.

## Actual validation attempts

| Command | Result |
|---|---|
| `npm ci --no-audit --no-fund` | Timed out twice before dependencies became available |
| `npm run typecheck` | Blocked: incomplete dependency/type installation; TypeScript reported missing type definitions (`react`, `node`, `aria-query`, Babel types, etc.) |
| `npm run build` | Blocked at the same TypeScript stage; Vite build did not run |
| `npm run test` | Blocked: `vitest` executable unavailable because dependencies were not installed |
| `npm run lint` | Not available: `package.json` has no `lint` script |
| `npm run test:rls` | Not run: requires Supabase CLI and a working local database; neither was verified available |
| Integration / E2E | No verified live Supabase credentials/database session or E2E runner was available |

`package.json` scripts discovered: `dev`, `build`, `preview`, `test`, `typecheck`, `test:rls`.

## Database migrations present in the archive

- `20261118000001_vortex_core_schema.sql`
- `20261118000002_vortex_row_level_security.sql`
- `20261118000003_vortex_storage_buckets_idempotent.sql`
- `20261118000004_stories_reels.sql`
- `20261118000005_stage1_security_hardening.sql`
- `20261118000006_notification_triggers.sql`
- `20261118000007_notification_reliability_and_storage.sql`
- `20261118000008_security_storage_community_hashtags.sql`
- `20261118000009_image_only_decommission_reels.sql`
- `20261118000010_messaging_direct_groups_realtime.sql`
- `20261118000011_private_image_story_storage.sql`
- `20261118000012_vortex_integrity_performance_hardening.sql`
- `20261119000013_post_media_and_feed_bounds.sql`
- `20261119115702_vortex_revoke_direct_execution_of_trigger_functions.sql`
- `VORTEX_migration15_README.txt`

No migration was applied to a remote database by this audit. No production data was modified.

## Existing tests

- `service_mock_behaviour.test.ts`
- `services.test.ts`
- `setup.ts`
- `translations.test.ts`
- `query.test.ts`

These files were inventoried, but could not be executed because dependencies were unavailable.

## Remaining blockers before production

1. Install dependencies successfully in a network-enabled environment, then run typecheck, tests, and build.
2. Connect to the intended Supabase project using a safe read-only database inspection path (never share a service-role key in chat). Verify actual constraints, table grants, RLS policies, function signatures/privileges, and applied migration history.
3. Reproduce and capture the exact `posts` 403 and `toggle_follow` 400 responses with authenticated session context; then fix only the confirmed root cause.
4. Execute SQL RLS/integrity tests against a disposable local Supabase database, followed by authenticated integration tests.
5. Run browser E2E and mobile viewport checks.

**Acceptance status:** relationship ambiguity source fix = applied; all other acceptance criteria = not yet verified. This delivery must not be represented as production-ready.
