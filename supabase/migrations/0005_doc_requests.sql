-- 0005: Crew document request flow.
--
-- A safety manager texts a hand a secure link; the hand photographs their new
-- CDL / H2S / medical card from their phone; the photo lands in a pending
-- queue on the crew book for review. Additive only — no existing table
-- changes. The public page writes through the SERVICE ROLE after validating
-- the token (anon has no policies here, same posture as readiness proofs).

create table if not exists public.saas_doc_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.saas_companies(id) on delete cascade,
  crew_member_id uuid not null references public.saas_crew_members(id) on delete cascade,
  -- Same CSPRNG shape as saas_readiness_proofs.token: 144 bits, unguessable.
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  kind_hint text,
  status text not null default 'pending' check (status in ('pending','submitted','done','revoked')),
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  submitted_at timestamptz,
  file_path text,
  submitted_kind text,
  submitted_expiration date,
  submitted_note text
);

alter table public.saas_doc_requests enable row level security;

-- Members send links and work the queue (same tier as add_record — this is
-- daily paperwork, not destruction). No session DELETE; dead requests are
-- status='revoked' so the audit trail survives.
create policy "doc_requests member select" on public.saas_doc_requests
  for select using (company_id in (select public.saas_user_company_ids()));
create policy "doc_requests member insert" on public.saas_doc_requests
  for insert with check (company_id in (select public.saas_user_company_ids()));
create policy "doc_requests member update" on public.saas_doc_requests
  for update using (company_id in (select public.saas_user_company_ids()));

create index if not exists saas_doc_requests_company_status_idx
  on public.saas_doc_requests (company_id, status);
create index if not exists saas_doc_requests_crew_idx
  on public.saas_doc_requests (crew_member_id);
