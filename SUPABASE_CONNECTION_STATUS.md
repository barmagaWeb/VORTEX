# VORTEX Supabase connection status

- Project: `VORTEX`
- Project ref: `iseqhovvpnzppttcoqgr`
- API URL: `https://iseqhovvpnzppttcoqgr.supabase.co`
- Region: `eu-central-1`
- Database: PostgreSQL 17
- Last verified: 2026-11-19
- Project status: `ACTIVE_HEALTHY`

## Hosted migration history

The live project currently has **9 recorded migrations**. The hosted history includes several follow-up repairs with custom version names; it is not identical to the 13-file baseline migration chain in the original archive.

The latest hosted migration is:

- `20261119172646_vortex_fk_covering_indexes_20261119`

It adds 23 non-destructive foreign-key covering indexes. Its exact SQL is included in `supabase/migrations/20261119172646_vortex_fk_covering_indexes_20261119.sql`.

**Do not run the original 13-migration baseline chain against this existing hosted database. Do not run `supabase db reset` against production.** Reconcile the complete local and remote migration histories before using automated migration push/pull workflows.

## Environment variables

Configure these in the local `.env` file or the hosting provider's build environment:

```dotenv
VITE_SUPABASE_URL=https://iseqhovvpnzppttcoqgr.supabase.co
VITE_SUPABASE_ANON_KEY=<your Supabase publishable key>
VITE_APP_URL=https://YOUR-DEPLOYED-VORTEX-DOMAIN
VITE_ENV=production
```

The frontend must use only the publishable/anon key. Never place a `service_role` key or secret API key in browser code or any `VITE_*` variable.

The delivery archive intentionally does not contain a real `.env` file or private credentials.
