-- 0007: Public demo mode — per-visitor throwaway companies.
--
-- A demo visitor gets a real (throwaway) auth user + their own seeded
-- company; the same row-level tenancy that separates paying customers
-- separates every visitor. is_demo gates: no outbound email/SMS ever, no
-- billing surface (checkout refuses, points at /signup), and the reaper
-- deletes demo companies + their users after 24h.

alter table public.saas_companies add column if not exists is_demo boolean not null default false;
create index if not exists saas_companies_demo_idx on public.saas_companies (is_demo, created_at) where is_demo;
