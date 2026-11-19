> **Superseded:** This report describes the previous archive state. See `CONTINUATION_UPDATE_REPORT.md` for the latest source and hosted database status.

# VORTEX — Final repair delivery status

**Date:** 2026-11-19  
**Bundle:** `VORTEX_FIXED.zip`  
**Status:** Source-level fixes prepared; **not production-certified**.

## Applied in this archive

- Corrected fresh-install migration ordering for `conversations.created_by` in migration 5.
- Removed the obsolete `handle_follow_counts()` override from migration 8; migration 12 re-establishes the accepted/pending-aware counter trigger for databases that already ran migration 8.
- Removed outer transaction wrappers from migrations 9–11.
- Added migration 12 with case-insensitive username uniqueness and validation, managed counters, content/attachment size and cardinality limits, private media owner-path restrictions, suspended-account write restrictions, basic database write-rate limits, trigram indexes, and atomic follow/like/repost/bookmark plus feed RPCs.
- Added migration 13 with a maximum of ten images per post checked with an AFTER-statement trigger, plus guards against moving media rows/changing their type, individual tag length checks, a community feed index, and For You ranking limited to the newest 2,000 RLS-visible candidates.
- Replaced the modal composer’s external image URL field with private Storage upload into the authenticated owner folder. Added 10 MiB client checks, image format/signature validation in the shared helper, post/tag input caps, and comment input limits.
- Filtered embedded like/bookmark/repost rows to the active user instead of downloading every user interaction; added deterministic ordering and bounded comment retrieval.
- Updated EN/AR messages for successful post publication.

## Validation results

| Check | Result |
|---|---|
| TypeScript/TSX parse | **Passed:** 85 files, zero syntax parse diagnostics. This does not prove full type correctness. |
| EN/AR translation parity | **Passed:** 267 keys in each dictionary. |
| JSON configuration parse | **Passed:** `package.json`, `package-lock.json`, `vercel.json`. |
| SQL static delimiter scan | **Passed:** dollar-quote delimiters balanced across 13 migrations. |
| Migration 9–11 transaction-wrapper scan | **Passed:** no outer standalone `BEGIN`/`COMMIT` wrappers. |
| pgTAP structural test definition | **Passed statically:** 20 planned assertions and 20 `ok()` calls. The test was **not executed**. |
| `npm run typecheck` | **Blocked:** dependency tree is incomplete; TypeScript reports missing implicit type definitions (`react`, `react-dom`, `node`, `aria-query`, Babel/Chai types, etc.). |
| `npm test` | **Blocked:** `vitest` is not installed. |
| `npm run build` | **Blocked before Vite:** the typecheck step fails due to missing types. |
| PostgreSQL migrations / pgTAP / live RLS | **Not run:** no PostgreSQL, Supabase CLI, or Docker runtime was available. |
| Browser E2E / live Auth, Storage, Realtime | **Not run:** requires a configured live Supabase project and browser test environment. |
| `npm audit` | **Not run:** registry access failed during dependency installation. |

`npm ci` did not complete: requests to `registry.npmjs.org` failed with DNS/network `EAI_AGAIN`, leaving `node_modules` incomplete. The source parse and SQL text scan are static checks only.

## Important outstanding items

1. **React Router security update:** this archive's lockfile resolves `react-router-dom` and `react-router` to 6.30.6. GitHub currently lists the backslash open-redirect advisory as affecting `react-router` versions `>=6.0.0, <7.18.0`, with 7.18.0 marked patched. The app remains on v6; a major-version migration must be handled and regression-tested rather than changed blindly without dependencies. See [GitHub Advisory GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6).
2. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and `npm audit` on a machine with registry access.
3. Apply migrations and run `supabase test db` on a disposable clean Supabase project. Then test the existing-project upgrade path with a backup and migration-history review.
4. Execute the actual RLS attack suite with two ordinary accounts and test private Storage access, suspended users, follow state transitions, media limits, and each feed RPC.
5. Verify nested PostgREST embeds, realtime behavior, signed URL refresh, CSP, SPA fallback, signup collision messaging, and authentication flows in a browser against the configured Supabase project.
6. Full cursor pagination, Arabic search normalization, server-side image decoding/re-encoding, storage cleanup, monitoring, and several social features remain outside this repair pass.

## Safe migration guidance

- **New database:** apply all 13 migrations in order.
- **Existing database with migrations 1–11 already recorded:** back up and verify history, then apply migrations 12 and 13 normally. Do not reset production or manually replay migrations 1–11.
- **Existing database where migration 12 is already applied:** apply only migration 13.
- The edits in migrations 5 and 8 affect clean installs only; a migration runner will not replay recorded migrations. Migration 12 restores the accepted/pending-aware follow counter function for already-migrated databases.
- Migration 12 stops if usernames collide case-insensitively. Resolve those collisions intentionally with account owners before retrying; it does not rename accounts.

**Release decision: do not deploy this archive as production-ready until the blocked dependency checks, database execution, RLS tests, and live browser verification have passed.**
