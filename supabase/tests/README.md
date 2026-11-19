# Database security integration tests

`rls_security.test.sql` is the pgTAP suite for database-level access control. It creates fixture users A, B, and admin, switches to the PostgreSQL `authenticated` role, and sets a distinct `request.jwt.claim.sub` for each assertion. Queries execute against PostgreSQL with RLS enabled; these assertions do not call the application's Mock services.

Run it after applying migrations to a clean local Supabase database:

```bash
supabase start
supabase db reset
supabase test db
```

The suite currently has 10 assertions covering private-post visibility, own private-post access, notification isolation, conversation message isolation, bookmark isolation, role escalation, audit-log access, community-post ownership, and anonymous execution of a visibility helper.

**Execution status for this delivery: NOT RUN.** The current build environment did not provide Supabase CLI, Docker, or `psql`. A test file existing in the repository is not a passing test result. Once the suite can be run locally, add further cases for follow-only posts, Storage object access, blocked interactions, and actual Auth/PostgREST requests made with distinct signed access tokens.

`src/test/service_mock_behaviour.test.ts` and other Vitest suites are application/Mock behavior tests. They are not PostgreSQL RLS integration tests.
