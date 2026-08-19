# Backups & restore — SYNNR production database

Written 2026-08-19 (pre-customer checklist). The database is Supabase project
`zbtxnvzxnpwdrpaxmliz` (us-east-1, Postgres 17), provisioned through the
Vercel marketplace.

## ⚠️ One thing to confirm by hand (2 minutes, do before the first customer)

The management API doesn't expose the billing plan, so confirm backup status
in the dashboard: **Supabase Dashboard → Project → Database → Backups.**

- **Paid (Pro) plan:** daily automated backups, 7-day retention. Good enough
  to start. You should see a list of dated backups on that page.
- **Free plan:** **no automated backups at all.** If the page is empty,
  upgrade before taking a paying customer — a $500/mo promise resting on an
  unbackuped database is a fire waiting for a match.
- **PITR (point-in-time recovery):** paid add-on, restores to any minute
  instead of last night. Worth it once several companies are live; not
  required day one.

## Restore procedure — full database

1. Supabase Dashboard → Database → Backups.
2. Pick the newest backup before the incident → **Restore**. This restores
   the WHOLE project to that moment (all companies — there is no per-tenant
   restore at this layer).
3. Expect a few minutes of downtime; the app recovers on its own once the DB
   is back (no redeploy needed — connection strings don't change).
4. Afterward run the integrity checks: `/op/health` in the app, and
   `docs/db-verification.sql` in the SQL editor.
5. Anything written between the backup and the incident is lost — check
   `saas_events` / `saas_cron_runs` gaps and tell affected customers what
   window disappeared. Honesty beats silence here, always.

## Restore procedure — one company's data (finer-grained)

Customer deletes the wrong yard and calls in a panic:

1. Their compliance data can be re-imported from any CSV export they made
   (Settings → Export — encourage customers to export monthly).
2. Without an export: restore the full backup to a NEW Supabase project
   (Backups → Restore to new project, on plans that support it), then copy
   that one company's rows across with SQL keyed on their `company_id`
   (tables: saas_yards, saas_units, saas_assets, saas_crew_members,
   saas_compliance_items, saas_unit_crew, saas_attachments). Do NOT restore
   the live project for a one-company mistake — everyone else loses their
   day's work.

## What's already covered without the dashboard

- **Schema:** fully reconstructable from `supabase/schema-snapshot.md` +
  `supabase/migrations/` (policies, functions, views, tables).
- **Storage (photos):** the `proofs` bucket is NOT covered by database
  backups. Photos are convenience attachments, not the system of record —
  acceptable loss at this stage, revisit if photos become load-bearing.
- **Stripe:** subscription state lives in Stripe and re-syncs via webhook +
  the nightly reconcile; a DB restore can't lose billing truth.

## Manual backup (belt-and-suspenders, optional)

From any machine with the connection string (Dashboard → Connect):

```bash
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner -Fc -f synnr-$(date +%F).dump
```

Keep a copy somewhere that isn't Supabase. A monthly manual dump costs one
minute and makes the worst case "we lost a month" instead of "we lost it all."
