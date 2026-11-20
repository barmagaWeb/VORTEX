# VORTEX — Connect. Share. Discover.

## Brand attribution

The supplied AUREX identity is included as the creator/developer brand for VORTEX in the landing-page footer and page metadata. The project files do not establish a registered legal company name, so the site intentionally does not claim that “AUREX” is an incorporated entity (for example, “AUREX Inc.” or “AUREX LLC”). Use the legal entity name only after it has been confirmed from official registration records.

VORTEX is a bilingual (Arabic/English), RTL/LTR, dark/light social-network application built with Vite, React 18, TypeScript, Tailwind CSS, React Router, and Supabase.

> **Production status: NOT READY.** The current source removes the paid-membership UI and active Reels/video product surface, adds image-only upload paths, and expands messaging and Realtime support. The SQL migrations have not been executed against a live/local Supabase database in this delivery, and dependencies could not be fully installed here. Read `IMPLEMENTATION_DELIVERY_REPORT.md` and `PRODUCTION_READINESS_REPORT.md` before deploying.

## Current capabilities

- Arabic/English interface with runtime RTL/LTR direction switching.
- Dark/light themes.
- Supabase-backed authentication, profiles, posts, comments, notifications, communities, stories, and messaging services.
- One-to-one conversation lookup/creation through an atomic database RPC, reducing race-created duplicate direct conversations.
- Group conversations with database-checked create/add/remove/rename/leave operations and a group-member management view.
- Message image attachments stored as private object paths and resolved to short-lived signed URLs when read.
- Supabase Realtime subscriptions for messages and notifications; the feed now listens only for new post inserts and shows a manual refresh affordance instead of refetching on every like/comment/follow event.
- Reels/video UI and active routes removed; post/story/message media uploads accept supported image formats only. Legacy Reel rows are retained under inaccessible legacy table names by an additive migration rather than destroyed.
- Paid plan / upgrade UI removed. No payment provider or billing UI is part of the active application.
- Development Mock adapters remain available only when Supabase is not configured. Production shows a configuration error page when required Supabase environment variables are absent; it does not silently fall back to demo data.

## Local development

Requirements: Node.js `>=20.19.0` and npm.

```bash
npm ci
cp .env.example .env
```

Set the values in `.env`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_APP_URL=http://localhost:5173
VITE_ENV=development
```

Apply every SQL file in `supabase/migrations/` in ascending filename order to the target database. Migration 12 is required by the new feed/toggle RPCs and integrity controls in this repair bundle. Use `SUPABASE_INTEGRATION.md` for the migration list, Auth redirects, and Storage notes. Never place a `service_role` key in browser code or in a `VITE_*` variable.

Start Vite:

```bash
npm run dev
```

When Supabase variables are absent in development, Mock data may be displayed for local UI work. Such records are not real users, are not persisted to Supabase, and must not be used to judge production behavior.

## Validation commands

```bash
npm run typecheck
npm test
npm run build
```

Database tests require a working Supabase CLI + Docker environment:

```bash
supabase start
supabase db reset
supabase test db
```

`supabase db reset` recreates the local database; do not run it against production. The SQL changes in this repair bundle have not been executed against a real Supabase database in this environment. Run the full migration chain and pgTAP suite before deploying.

## Project structure

```text
src/
  app/                 React application and router
  components/          UI, layout, feed, stories components
  context/             Auth, language, theme, toast providers
  pages/               Auth, feed, explore, profile, messages, etc.
  services/
    interfaces/        Domain service contracts
    mock/              Development/test Mock implementations
    supabase/          Supabase implementations and client/storage helpers
  test/                Vitest unit/service tests
  constants/           Mock data and EN/AR translations
  types/               Domain TypeScript types
supabase/
  migrations/          Twelve ordered migrations (including follow-up hardening)
  tests/               pgTAP security and integrity regression tests
```

## Project documents

- `SUPABASE_INTEGRATION.md` — configuring Supabase and applying all migrations.
- `IMPLEMENTATION_DELIVERY_REPORT.md` — changes in this delivery and incomplete requirements.
- `PRODUCTION_READINESS_REPORT.md` — current blockers and deployment decision.
- `AUDIT_REPAIR_VALIDATION.md` — validation commands and actual outcomes.
