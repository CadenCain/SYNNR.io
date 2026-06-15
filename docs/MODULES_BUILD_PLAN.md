# SYNNR Modules — Build Plan & Schema (from the 3 specs, reconciled to the live app)

Source docs: **Master Build Prompt**, **AI Ingestion Engine spec v1.0**, **Digital Yard
Twin spec v1.0** (June 2026). This file reconciles them with what's already shipped and
proposes the schema. **Nothing here is applied yet — schema needs sign-off first** (per
the Master prompt's own instruction).

## The big picture
The three specs describe SYNNR as a self-serve operating system for oilfield service
companies (wireline-first), three modules in strict order:
1. **AI Ingestion Engine** — messy files → structured, confidence-scored data + HITL review.
2. **Digital Yard Twin** — assets as a finite state machine; Vision-AI loadout verification.
3. **Intelligent Ticketing** — Kanban field tickets, gated "Ready to Bill", priced from #1, staffed from #2.

This is the same destination as `docs/ROADMAP.md` (readiness → dispatch → OS) — the specs
just make Modules 1–2 rigorous. This doc supersedes the roadmap's phase detail.

## Reconciliation — we are NOT starting from empty
| Spec calls for | What already exists | Action |
|---|---|---|
| `tenant_id` on every table | `workspace_id` + RLS on all 12 tables | **tenant = workspace.** Keep `workspace_id`. No new tenancy concept. |
| OpenAI API + Structured Outputs | AI SDK `generateObject` via **Vercel AI Gateway** (zod schemas) | Keep AI Gateway — it IS the "or equivalent". No raw OpenAI SDK. |
| Prisma or Supabase client | Supabase client + hand-written types | Keep Supabase, no Prisma. |
| Shadcn/UI | Custom scoped CSS per page (`.dash`, `.audit`, …) | Keep our design system — "look stays the same" is a hard rule. |
| Ingestion engine (greenfield) | `lib/engine/` already extracts + runs deterministic detectors | **Upgrade**, don't replace: add per-field confidence + classification + HITL. |
| Rate-sheet ingestion | `pricebook_rules` table exists | Extend it (service_code, effective_date, discount, source doc). |
| Ticketing pipeline | `jobs` + `findings` + packet/billing-handoff already built | Module 3 = add a Kanban `stage` to `jobs` + gating. Reuse, don't rebuild. |

## Two decisions for the founder
1. **Positioning: wireline-first beachhead, or keep broad?** The specs are wireline-flavored
   (perforating guns, CCL, WL-PERF-01, H2S). Recommendation: **build the schema/engine
   generic (it already is), but go to market wireline-first** — deepest pain, sharpest vocab,
   "own your lane." Marketing stays service-company-broad in framing, leads with wireline proof.
   No schema impact either way.
2. **Hard dependency:** real ingestion needs the **Vercel AI Gateway card** (free credits, but
   required — real uploads 502 without it today). Sample path works cardless; *customer* docs do not.

## Proposed build order (each phase shippable)
- **M1.P1 — Ingestion foundation (first paying customer):** documents + extracted_fields
  tables; classification (cert vs rate sheet) + per-field confidence in `lib/engine`; async
  `/api/v1/ingest`; **HITL side-by-side review UI** (source left, fields right; amber=prefilled,
  red=blank). Output → `certifications` + `pricebook_rules`.
- **M1.P2 — Vision:** loadout-photo + scanned-ticket extraction (unlocks the Twin).
- **M2.P1 — Static Twin:** `assets` + `asset_state_events` FSM; schematic dark dashboard
  (green/amber/red), drill-down to contained items.
- **M2.P2 — Vision loadout verification (killer feature):** truck-bed photo → identified tools
  vs job requirements → `LOADED_VERIFIED` or `BLOCKED`, blocks dispatch.
- **M3 — Intelligent ticketing:** `jobs.stage` Kanban (Draft→In Field→Pending Signatures→
  Ready to Bill), gated by signatures + loadout-verified + rate match. Reuses existing packet.
- **M2.P3 — Predictive maintenance / telematics:** deferred (Samsara/Geotab) — Phase 3.

## Proposed schema (Supabase SQL — NOT YET APPLIED, pending approval)
All tables: `workspace_id` FK + RLS `using (workspace_id = current_workspace_id())`,
`gen_random_uuid()` PKs, `created_at timestamptz default now()` — matching existing conventions.

```sql
-- ===== MODULE 1: AI Ingestion Engine =====
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  source_file text not null,
  mime text,
  storage_path text,
  channel text not null default 'web' check (channel in ('web','mobile','email','api')),
  document_type text check (document_type in
    ('CERTIFICATION','FIELD_TICKET','RATE_SHEET','LOADOUT_PHOTO','MSA_DOCUMENT','SOP_DOCUMENT','UNKNOWN')),
  classification_confidence real,
  status text not null default 'processing'
    check (status in ('processing','complete','partial','failed','unmapped')),
  fields_auto_accepted int not null default 0,
  fields_review int not null default 0,
  fields_manual int not null default 0,
  structured_data jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.extracted_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  field_path text not null,                 -- 'expiration_date', 'line_items[0].rate'
  label text,
  value jsonb,
  confidence real not null default 0,
  flag text not null check (flag in ('AUTO_ACCEPTED','REVIEW_REQUIRED','MANUAL_ENTRY')),
  business_rule_override boolean not null default false,
  source_region jsonb,                      -- bbox for HITL highlight
  corrected_value jsonb,
  corrected_by uuid references auth.users(id),
  corrected_at timestamptz,
  created_at timestamptz not null default now()
);

-- ===== MODULE 1 OUTPUT: certifications (rate sheets extend pricebook_rules) =====
create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  employee_name text not null,
  cert_type text not null,
  issuing_body text,
  issued_date date,
  expiration_date date,
  source_document_id uuid references public.documents(id) on delete set null,
  status text not null default 'active'
    check (status in ('active','expiring','expired','pending_review')),
  created_at timestamptz not null default now()
);

alter table public.pricebook_rules
  add column if not exists service_code text,
  add column if not exists effective_date date,
  add column if not exists discount_pct real,
  add column if not exists source_document_id uuid references public.documents(id) on delete set null;

-- ===== MODULE 2: Digital Yard Twin =====
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_asset_id uuid references public.assets(id) on delete set null,   -- truck contains tools
  name text not null,
  category text,                            -- truck, perforating_gun, ccl, sling, consumable…
  asset_kind text not null default 'item' check (asset_kind in ('node','item')),
  identifier text,
  state text not null default 'yard_available' check (state in
    ('yard_available','staged_for_loadout','loaded_verified','dispatched_active','maintenance_required')),
  calibration_date date,
  inspection_date date,
  expected_lifespan_cycles int,
  cycle_count int not null default 0,
  crew_id uuid references public.crews(id) on delete set null,
  current_job_id uuid references public.jobs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.asset_state_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  from_state text,
  to_state text not null,
  trigger_source text not null check (trigger_source in
    ('vision_ai_photo','dispatch_sync','inspection','predictive','manual','telematics')),
  confidence real,
  job_reference text,
  created_at timestamptz not null default now()
);

-- ===== MODULE 3: Intelligent Ticketing (reuses jobs) =====
alter table public.jobs
  add column if not exists stage text default 'draft'
    check (stage in ('draft','in_field','pending_signatures','ready_to_bill','billed'));
-- FSM transition legality + Kanban gating enforced in app/RPC, not schema.
```

Plus, on apply: `alter table … enable row level security` + per-table workspace policies +
`create index … on (workspace_id)` for each new table, matching the existing pattern.
