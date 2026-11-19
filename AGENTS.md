# AGENTS.md — VORTEX Engineering Rules

You are working in VORTEX, a React 18 + TypeScript + Vite + Supabase social application. Read this file before making changes.

## Mandatory workflow
1. Inspect the repository, relevant pages/components, service interface, Supabase implementation, Mock implementation, types, migrations, and tests before editing.
2. Select and read the applicable skill(s) from `.agents/skills/`. For cross-cutting work, read more than one.
3. Write a short implementation plan for non-trivial changes.
4. Make the smallest coherent change. Preserve VORTEX's identity and existing working behavior unless asked otherwise.
5. Keep service contracts, Supabase and Mock implementations, TypeScript types, UI, translations, SQL policies, and tests aligned.
6. Add regression tests. Run available checks and report exact outcomes.
7. Summarize completed work, unverified items, remaining risks, and any required user action.

## Skills index
- `.agents/skills/01-frontend-ui-ux/SKILL.md`
- `.agents/skills/02-react-architecture/SKILL.md`
- `.agents/skills/03-typescript-code-quality/SKILL.md`
- `.agents/skills/04-database-schema-migrations/SKILL.md`
- `.agents/skills/05-rls-security/SKILL.md`
- `.agents/skills/06-auth-identity-sessions/SKILL.md`
- `.agents/skills/07-social-graph-communities/SKILL.md`
- `.agents/skills/08-feed-posts-interactions/SKILL.md`
- `.agents/skills/09-messaging-realtime/SKILL.md`
- `.agents/skills/10-media-storage/SKILL.md`
- `.agents/skills/11-notifications-events/SKILL.md`
- `.agents/skills/12-search-discovery/SKILL.md`
- `.agents/skills/13-moderation-admin-abuse/SKILL.md`
- `.agents/skills/14-testing-quality-assurance/SKILL.md`
- `.agents/skills/15-performance-accessibility-i18n-operations/SKILL.md`

## Project-specific guardrails
- Do not copy Reelo's legacy PHP, schema, or UI wholesale into VORTEX. Reelo is reference material only; VORTEX remains the React/TypeScript/Supabase application.
- Respect the current image-only scope described in the latest delivery report. Do not reintroduce Reels/video or paid upgrade UI unless the product owner explicitly changes scope.
- Treat Supabase RLS as the authorization boundary. UI checks are not security.
- Never put Supabase service-role keys or private API secrets in frontend code or `VITE_*` variables.
- Do not claim that SQL, RLS, Storage, Realtime, or production flows work until they have been run against a configured Supabase environment.
- A test file existing is not proof that the test passed. A syntax parse is not a typecheck. A successful local build is not proof of production readiness.
- Never delete data, rewrite applied migrations, or make destructive schema changes without explicit approval and a safe migration/backup plan.
- Never use fake data, fake unread counts, fake feature buttons, or fake success messages in production paths.
- Do not invent missing product requirements. Ask one focused question only when a decision blocks safe implementation.
