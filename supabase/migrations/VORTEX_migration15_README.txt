VORTEX - Migration 15

File:
20261119115702_vortex_revoke_direct_execution_of_trigger_functions.sql

Purpose:
Revoke direct EXECUTE privileges from PUBLIC, anon, and authenticated for four
trigger-only SECURITY DEFINER functions. Their existing triggers remain attached
and continue to execute as part of the triggering database operations.

Status:
This migration was applied successfully to Supabase project
iseqhovvpnzppttcoqgr and verified: anon_execute=false,
authenticated_execute=false, trigger_count=1 for each function.

Important:
This is the new migration file created for the latest database change.
The integrity_hardening.test.sql and rls_security.test.sql files are test scripts,
not migrations; they were run separately and were not modified by this change.
