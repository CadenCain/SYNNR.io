-- ══════════════════════════════════════════════════════════════════════════
-- TRUST AUDIT — the four questions only the live database can answer.
-- Run in Supabase Studio → SQL editor (or hand to Claude when the Supabase
-- connector is reconnected). Each block says what a bad answer looks like.
-- Written 2026-08-17; the app-code side of these findings is already fixed.
-- ══════════════════════════════════════════════════════════════════════════

-- 1. STORAGE RLS — the proofs bucket.
-- The browser uploads DIRECTLY to storage with the user's token, path chosen
-- client-side. Only a storage.objects policy stops company A uploading (or
-- reading) under company B's prefix. The app-side guards added 2026-08-17
-- stop poisoned paths being PERSISTED, but the bucket itself must also hold.
-- BAD: zero rows, or a policy that doesn't compare the path's first segment
--      to the caller's companies.
select polname, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects';

-- Also confirm the bucket is private:
select id, public from storage.buckets where id = 'proofs';  -- public must be FALSE

-- 2. LOADOUT TABLES — can a tenant write another tenant's (or the global
-- seed) template items? The app now guards this in code; RLS should agree.
-- BAD: an UPDATE/DELETE policy on saas_loadout_items with qual = true, or
--      none at all with RLS disabled.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('saas_loadout_items','saas_loadout_templates');

select polname, cmd, qual, with_check
from pg_policies
where tablename in ('saas_loadout_items','saas_loadout_templates');

-- 3. PROOF TOKEN — must be a crypto-strength default, not guessable.
-- GOOD: gen_random_uuid() or encode(gen_random_bytes(n),'hex').
-- BAD: anything sequential, short, or app-supplied.
select column_name, column_default
from information_schema.columns
where table_name = 'saas_readiness_proofs' and column_name = 'token';

-- 4. DISPATCH CHECKS IMMUTABLE — marketing says checks are read-only after
-- creation. Code has no update/delete path; the DB should refuse them too.
-- BAD: any UPDATE or DELETE policy rows here.
select polname, cmd, qual
from pg_policies
where tablename in ('saas_dispatch_checks','saas_dispatch_check_items')
  and cmd in ('UPDATE','DELETE');

-- ══════════════════════════════════════════════════════════════════════════
-- 5. WHILE YOU'RE IN HERE: dump the schema into the repo so the next audit
-- can verify policies from source instead of flagging them "unverifiable."
-- From a machine with the DB URL:
--   supabase db dump --schema public --file supabase/migrations/0000_schema_baseline.sql
-- ══════════════════════════════════════════════════════════════════════════
