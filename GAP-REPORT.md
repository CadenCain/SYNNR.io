# Gap Report — SYNNR vs. the Yard-Command spec

**2026-08-21.** Audit of the existing product against the externally-drafted
spec (pasted in-session; not in repo). Owner override in force: **pricing
stands at $500/yard/month** — spec §3's $1,000 directive is void. No code
changed for this report except one production data fix (see §4, incident 2).

---

## 1 · SPEC §6 vs REALITY

| Feature | Verdict | Evidence |
|---|---|---|
| 6.1 Asset registry — records, types, status, photos, paperwork | **PARTIAL (strong)** | `saas_assets` + [app/app/assets/[assetId]](app/app/assets/[assetId]/page.tsx): name, category taxonomy, identifier, status (in-service/missing/out-of-service), last-seen, primary photo + paperwork photo (two-slot card, amber when missing), attachments. **Gaps:** no pressure-rating field (lives in free-text names), no "at cert shop" location state, cert history has **no timeline UI** (history exists as attachments + events only), **no PDF upload** — camera images only. |
| 6.2 Tag & scan (QR/NFC, no-login read, <10s) | **MISSING** | Zero tag/scan/QR code paths in the app. The foundation exists — the tokened public read-only view pattern ([app/proof/[token]](app/proof/[token]/page.tsx)) is exactly the "scan → asset page, no login wall" mechanic — but no per-asset tokens, no tag printing, no scan route. **This is the largest single spec gap and the only feature IronTrac has that SYNNR doesn't.** |
| 6.3 Expiry alerts | **PARTIAL** | BUILT: daily email job (Vercel cron 11:30 UTC → [saas-alerts route](app/api/cron/saas-alerts/route.ts) → [lib/saas/alerts.ts](lib/saas/alerts.ts)); recipient list with **per-yard routing** (exceeds spec); digest with counts + direct link; once-per-item dedup; renewal re-arm ([alert-log.ts](lib/saas/alert-log.ts)); failed-send retry. **MISSING:** ① multi-threshold escalation (30/14/7/day-of) — one company-wide window (`lead_days`); the per-item `reminder_days` column exists in schema but no UI edits it and the sweep ignores it; ② **"EXPIRED-and-still-active" re-alerts — an expired item alerts ONCE, then never again until renewed** ([alert-window.ts](lib/saas/alert-window.ts): `alreadyAlerted → false`). The spec calls this state the loudest; today it's the quietest. ③ Critical-asset escalation flag — no such concept. |
| 6.4 Dashboard "full eyes" | **BUILT** | [app/app/page.tsx](app/app/page.tsx) + dashboard-view: totals, red on top, expiring list, needs-attention, activity, yard filter, 14-day trend. **Gaps:** no pending-submissions count on the dashboard (queue surfaces only on crew pages); no asset-type filter. |
| 6.5 Pending queue + audit log | **PARTIAL** | Queue exists **only for crew card photos**: public upload ([app/u/[token]](app/u/[token]/page.tsx)) → `saas_doc_requests` → review queue on crew pages. Asset flags ("this looks wrong") have **no queue** — flagging missing writes the status directly. Audit: actor-attributed event stream (`saas_events`, append-only enforced by DB trigger, migration 0006) + immutable dispatch records — but **no per-field before/after values anywhere**, and some mutations (e.g. unit rename) emit no event at all. |
| 6.6 Yard-walk onboarding mode | **PARTIAL** | Quick action ([app/app/quick](app/app/quick/quick-client.tsx)) chains unit→cert→gear with camera-first capture — close in spirit. No tag assignment (no tags), no photo→next-asset rapid loop. The CSV importer with dry-run preview covers the spreadsheet path. |

## 2 · DESIGN LAW VIOLATIONS (spec §4)

| Law | Verdict |
|---|---|
| 1 Photos over typing | Mostly honored: OCR camera renew with human confirm gate, two-photo asset intake, doc-request photo flow. **Violations:** desktop add-cert forms are type-first; the public doc page asks for a typed date alongside the photo. |
| 2 Ten-second rule | Quick flows qualify. **Structural violation: with no scan, every field-side lookup starts with search or navigation** — the spec's core interaction (tag → record in 10s) has no equivalent. |
| 3 Works with no signal | **VIOLATED WHOLESALE.** No offline queue; a submission on dead signal errors and is lost. Worse: a **fossil TallyShot service worker is registered on the live site right now** ([public/sw.js](public/sw.js) via [app/sw-register.tsx](app/sw-register.tsx)) — cache named `tallyshot-v1`, precaching `/ingest`, a route that 307s to home. It provides installability theater and none of the spec's offline substance. Rip it or replace it; don't leave it. |
| 4 Every write leaves fingerprints | PARTIAL — see 6.5. Who/what/when: yes, in prose. Before/after values: no. Pencil-whipping a date change is visible as *an event*, not as *what changed*. |
| 5 Paper matches software | PARTIAL — the OCR confirm gate enforces agreement at entry; nothing detects photo-vs-typed drift after the fact. |

## 3 · ENFORCEMENT AUDIT (spec §5)

**Field users CAN write directly.** Members renew certs, add records, and set
locations without approval — [entitlements.ts](lib/saas/entitlements.ts)
`MEMBER_ACTIONS`, enforced in every server action via `assertCan`/gates AND at
the database in RLS (migration 0004; verified policy map in
[supabase/schema-snapshot.md](supabase/schema-snapshot.md)). Deletes are
admin-only; billing/ownership owner-only.

This **deviates from the spec by the owner's explicit prior decision**
(2026-08-19 spec: "members do the daily work") — it is a different trust
philosophy, not an enforcement hole: every write is permission-checked
server-side, tenancy-walled in RLS, and actor-attributed. The spec's
management-only + approve-queue model exists in the codebase for exactly one
flow (crew doc requests) and could generalize as an optional "strict mode" —
ROADMAP material, not a defect. Audit-log gap: real (see §2 law 4).

## 4 · ALERT RELIABILITY — traced end to end

Pipeline: sweep (every error surfaced — a failed READ or an undeliverable
company is loud, never skipped) → heartbeat row per run → public
[/api/health](app/api/health/route.ts) returns 503 on stale/failed →
[watchdog cron](app/api/cron/alert-watchdog/route.ts) 13:30 UTC emails the
operator on no-run/failed-run → **external GitHub Actions pinger** (2×/day,
different infrastructure) fails loud → GitHub email. Failed customer sends
log an in-app event and retry next sweep.

**This chain has two confirmed live catches:**
1. **Aug 19** — phantom SMS attempt (no Twilio) → sweep flagged → watchdog
   emailed → pinger failed → root-caused → self-healed next sweep.
2. **TODAY, Aug 21** — sweep failed: `NO RECIPIENTS for Caprock — 6 due
   item(s) UNDELIVERABLE`. Root cause: converting a demo yard into the
   permanent showcase (proof-link source) set `is_demo=false`, dropping it
   out of the sweep's demo-skip; a member-less company with due items
   correctly triggered the no-silent-skips alarm. **Fixed in production
   during this audit** (showcase → `status='none', comped=false`: sweep now
   skips it as non-writable; the proof link renders regardless — verified
   200). Sweep manually re-run: `ok=true, errs=0`, health 200.

**Weaknesses, stated plainly:** expired-and-still-active items go silent
after one alert (§1, 6.3 — the worst product gap in this report); one send
window per day; single email provider (Resend); the operator-alarm email
rides the same provider it reports on (mitigated only by the GitHub path).
Demo-yard reaper: verified working by effect (Aug-20-morning yards deleted,
younger survive) — its count is missing from the watchdog's detail string, a
cosmetic logging bug.

## 5 · SCOPE CREEP (spec §7)

Present in the codebase and out of scope by both specs — **rip-out list**
(none of it blocks selling; schedule a cleanup sprint after customer #1):
- Dead marketplace era: `rd_*` tables, `workspaces`, `gearvault` bucket with
  bucket-wide authenticated policies (flagged in the schema snapshot), legacy
  route remnants.
- TallyShot era: `public/sw.js` + `app/sw-register.tsx` (the fossil worker),
  tally tables.
- Managed-service era: the entire `/op` operator portal (live behind
  /op/login) — a second product surface nobody uses.
- `/build` custom-builds marketing page: a services pitch, not product code —
  owner's call, harmless to leave.
- No pitch-deck AI anywhere; the only AI is the OCR date-read with human
  confirm — the exact pattern §7.1 sanctions.

## 6 · PRICING CHECK (owner-modified standard: $500)

`$500` appears consistently: homepage ×3, /demo ×1, /onepager ×1, checkout
(live Stripe price), signup copy. **Zero** occurrences of $1,000, $750, or
$1,500 anywhere in `app/`. Setup copy everywhere says free for the first 10
yards. (Note: an earlier grep in this audit used broken shell quoting and
"verified" absence vacuously; re-run with `grep -F` — these numbers are from
the corrected pass.)

---

## RANKED

**CRITICAL**
1. **Expired-and-still-active items never re-alert.** One email, then
   silence while the truck keeps rolling on dead paper. Small fix (~30 min:
   re-alert every N days while expired; sweep + alert-window + tests).
2. Alert-pipeline single-day-window + the incident class fixed today —
   monitoring proved itself twice; keep it feared and respected.

**IMPORTANT**
3. QR tags → per-asset tokened views (the IronTrac parity gap; proof-link
   pattern makes it days, not weeks).
4. Multi-threshold escalation + critical-asset flag (half the plumbing —
   `reminder_days` — already in schema).
5. Per-field before/after audit values; events on every mutation.
6. Offline submission queue (the biggest honest build; the fossil SW must
   die either way).
7. PDF paperwork upload.

**NICE-TO-HAVE**
8. Cert history timeline UI · yard-walk rapid-capture mode · dashboard
   pending-count + asset-type filter · strict-mode approval queue (only if
   the owner reverses his roles decision).

## SHORTEST PATH TO DEMO-READY (Midland desk)

**The demo is ready now.** Verified end-to-end repeatedly this week; 16
strangers' demo yards exist as of this morning. Before the first shop owner:
1. Ship CRITICAL #1 (expired re-alerts) — the one gap a customer hits in
   week one. ~30 minutes.
2. Owner tasks, unchanged from AUDIT.md: Stripe portal cancel toggle check;
   the Spy $500 self-purchase (webhook-in-anger); rename the `renegade` org
   if demoing from your own login instead of /demo.
3. Nothing else. Everything above the line is post-first-customer work.
