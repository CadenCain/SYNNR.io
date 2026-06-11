# SYNNR Build Roadmap — Readiness → Dispatch → Operating System

**Positioning rule (do not break):** SYNNR is *field-operations readiness software*.
We never market "an OS." The OS emerges because dispatch + readiness + billing
end up running the customer's day. Sell the wedge; become the system.

**Differentiator (the moat):** legacy dispatch schedules work. SYNNR is the only
board where a **Blocked job can't roll** — expired cert, missing tool, failed
inspection, absent customer form = hard gate, with a logged manager override.
Compliance isn't a report after the fact; it's enforced at dispatch time.

**Pricing fit:** Pro $499 = readiness core (certs, loadouts, packets, checks).
Growth $999 = the dispatch board + team access + customer-rule library.
Dispatch is the Growth-tier driver — the upsell story writes itself.

---

## Phase 0 — Validation (now, before any new code)
- Stripe live (bank → products → webhook → secrets), Resend SMTP, AI Gateway credit.
- Collide post per the business plan → 3 operators share one messy job workflow.
- Deliver 3 readiness audits ($250–500) using the current app + manual review.
- **Exit criteria:** we know which checks operators actually pay for, and 1–2
  pilots agree to $299/mo beta. The audits decide Phase 1's exact checklists.

## Phase 1 — Readiness objects (~week 1–2 of build)
The nouns dispatch will gate on. All RLS-scoped per workspace, CSV-importable
(fit beside their spreadsheets — never demand migration).
- **People & certs:** employees, role, certs (type, issued, expires, doc upload).
  Expiry status computed against *scheduled* work, not just today.
- **Assets & tools:** trucks + equipment, status (ready/down/in-shop),
  inspection/calibration due dates, assigned yard/crew.
- **Job types & loadout templates:** per job type (+ per customer): required
  roles/certs, tools, consumables, forms/photos. This is the rule library —
  every template a customer builds makes leaving harder.
- UI: make Crews & Teams real (it's demo today); new Certs and Assets views.
  Reuse existing list/row components — zero new design language.

## Phase 2 — Job readiness score (~week 2–4)
- Job profile: customer, job type, scheduled date, assigned crew + assets.
- Deterministic readiness engine (same philosophy as lib/engine/detect.ts —
  LLM extracts, rules decide): every job scores **Ready / At Risk / Blocked**
  per category (crew, truck, tools, inventory, paperwork, customer rules,
  billing backup) with reason + fix per flag, manual override with audit trail.
- The existing audit-detail page becomes the **Job Readiness Report** — same
  layout, evidence panel, and action buttons; categories swap in.

## Phase 2.5 — Field capture, mobile-first (~week 3–5, overlaps Phase 3)
The input artery. Crews photograph reality all day — tickets, job reports,
pressure tests, gauges, signatures, site photos. SYNNR is the smart friend
that takes ANY data the company throws at it and figures out what it is.
- **PWA, not an app-store build:** installable from synnr.io on the crew's
  phone, full-screen, camera capture. Zero IT, zero downloads to approve.
- **Snap flow:** big capture button → photo → SYNNR auto-suggests the job
  (the crew's dispatched job today — dispatch data makes capture smart) →
  upload to the workspace bucket.
- **The smart-friend layer:** vision extraction (already wired —
  lib/engine/extract.ts) classifies the artifact (ticket / invoice / test
  sheet / photo evidence / signature), attaches it to the job, and updates
  packet completeness + readiness flags in real time. The office watches
  packets fill themselves in.
- **Offline reality:** field sites have no signal. Capture queues locally
  (service worker) and syncs when coverage returns. v1.5 if needed, but
  design for it from day one.
- **Later (v2): text-it-in.** A workspace MMS number (Twilio) + email-in
  address — crews who won't open any app can text photos. Zero training.
- Why it matters commercially: this gives all three roles a daily habit —
  dispatcher (board), crew (capture), office (packets/billing). Three hooks
  beats one.

## Phase 3 — Dispatch board (~week 4–6) — the Growth-tier product
- Week board: crews × days. Jobs are cards wearing their readiness chip.
- Assign crew + truck on the card; **assignment re-scores readiness live**.
- **The gate:** Blocked jobs can't be dispatched. Override = manager action,
  reason required, logged. (Trust comes from override, not blind automation.)
- Day-of loadout checklist per job — printable / phone-friendly; crew checks
  off before rolling. This is the daily ritual that makes SYNNR sticky.
- Conflict flags: crew or asset double-booked same day.

## Phase 4 — Close the loop (already mostly built)
- Job completes → field packet completeness (exists) → invoice-ready packet
  (exists) → billing handoff (exists). Schedule → verify → roll → prove → bill.

## Deliberately NOT building
GPS/telematics, customer-facing booking, payments/payroll, route optimization,
app-store native apps (field capture is an installable PWA with camera —
mobile-first, but no Swift/Kotlin codebases), deep two-way ERP sync (CSV first).
Every one of these is a quarter-long swamp owned by incumbents. The wedge wins
on verification, not feature count.

## Success metrics (per pilot customer)
- Jobs blocked *before* dispatch that would have failed (the hero number).
- Packet completeness rate at invoice time; rejected-invoice rate trend.
- Weekly active dispatcher usage (the stickiness signal).
