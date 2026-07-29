-- A successful sweep with nothing to send writes nothing, so a healthy quiet
-- day and a dead cron looked identical. This is the heartbeat: every run
-- leaves a row whether or not it had anything to say.
create table if not exists saas_cron_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  ran_at timestamptz not null default now(),
  ok boolean not null default true,
  companies_scanned int not null default 0,
  alerts_sent int not null default 0,
  errors int not null default 0,
  detail text
);

create index if not exists saas_cron_runs_job_ran_idx on saas_cron_runs (job, ran_at desc);

-- Operator-only data. No customer ever reads this, so no policies: RLS on with
-- zero policies denies every session-scoped client, and the service role
-- (which the cron uses) bypasses RLS by design.
alter table saas_cron_runs enable row level security;

comment on table saas_cron_runs is
  'Heartbeat for the daily crons. One row per run, written even when the run had nothing to send, so /op/health can tell "quiet" from "dead". Operator-only: RLS on with no policies.';
