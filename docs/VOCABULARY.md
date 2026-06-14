# SYNNR Vocabulary — the operator dictionary

One wrong word and an operator decides *this was built by someone who's never
been on location.* This doc keeps the marketing site, the app UI, the glossary,
and the Collide posts all speaking the same language — the language of a field
hand, not a SaaS founder.

**Source of truth:** the live glossary at [`lib/content/glossary.ts`](../lib/content/glossary.ts)
(rendered at `/glossary`). When you introduce a new term anywhere — UI label,
landing copy, a Collide post — add it to the glossary first, then use it. The
glossary is also linked from the marketing nav, the dashboard sidebar (Support),
the footer, and from finding-category chips in the audit detail.

---

## 1. Core status language (never change these three)
Every job, every check resolves to exactly one:
- **Ready** — cleared to move (dispatch / bill).
- **At Risk** — will work, but something needs attention (cert expiring, low
  consumables, packet incomplete).
- **Blocked** — cannot move until fixed (expired cert, missing required form,
  unsigned ticket).

Use these words as proper labels (capitalized) in UI and copy. They're easier
to trust than a vague AI "confidence score," and they map to a decision an
operator actually makes.

## 2. The product's own nouns
- **SYNNR** — the product. Wordmark is all-caps in the logo; in prose write
  "SYNNR."
- **Readiness check** — the core action. **Preferred over "audit"** in
  user-facing copy. ("Run a readiness check," not "run an audit.") The `/audit`
  route and engine internals may still say audit; the *words users see* say
  readiness check.
- **Readiness report** — the output artifact (Ready/At Risk/Blocked + reasons +
  fixes).
- **Job packet** — the bundle of proof for a job (tickets, photos, tests,
  sign-offs). Not "documents," not "files" when you mean the packet.
- **Loadout** — what goes on the truck for a job. Not "kit," not "gear list."
- **Finding** — one issue SYNNR surfaces on a job.
- **Pro / Growth** — the plan names. ($499 / $999, flat monthly.) Never
  "Recover / Command" (dead names) and never "tier 1/2."

## 3. Finding categories (the fixed set)
These are the categories the engine assigns. Use them verbatim — they appear in
the app and should match marketing. Four link to a glossary term (chip is
clickable in the audit detail):

| Category | Means | Glossary link |
|---|---|---|
| **Missing Billable** | work performed, never invoiced | `missed-billable` |
| **Rate Mismatch** | billed below the contracted/MSA rate | `rate-sheet` |
| **Missing Backup** | packet missing required proof (photos, tests) | `invoice-backup` |
| **Dispute Risk** | likely to be short-paid / disputed | `short-pay` |
| **Duplicate Charge** | same line billed twice | — |
| **Discount Error** | wrong discount applied | — |
| **SLA Risk** | billing/response deadline at risk | — |

## 4. Say this / not that
Operator-correct on the left; tells-on-you on the right.

| Say | Not | Why |
|---|---|---|
| field ticket | "work order form" / "job sheet" | what crews actually call it |
| job packet | "documentation bundle" | the real term for the proof bundle |
| loadout | "equipment kit" / "packing list" | yard/dispatch word |
| standby (time) | "idle time" / "waiting charges" | it's a billable line with a rate |
| mob / demob | "setup & teardown fees" | contracted line items |
| rigging inspection (slings & shackles) | "torque wrench calibration" on a crane job | match the term to the actual job type |
| H2S cert, SafeLand, BOP recert | "safety certification" (generic) | name the specific cert operators carry |
| MSA / rate sheet | "the contract" / "pricing doc" | the documents rates actually live in |
| company man | "the customer's guy on site" | the person who signs the ticket |
| invoice backup | "supporting docs" | what AP audits before paying |
| short pay | "partial payment dispute" | the industry term |
| readiness check | "audit" / "scan" | the product's user-facing verb |
| field operations / service company | "SMB" / "the vertical" | who they are |

## 5. Match the term to the job type
Generic-trades vocab on an oilfield story is the fastest credibility leak.
Tie examples to the job:
- **Crane & rigging job** → rigging inspection (slings & shackles), rigger cert,
  pull test — not torque wrenches.
- **Wireline / pressure** → BOP recert, pressure gauge calibration, pull-test
  sheet.
- **Sour gas location** → H2S cert, gas detector calibration, SafeLand.
- **Any location** → JSA, tailgate meeting, company-man sign-off.

When in doubt about a specific basin/discipline term, check the glossary or ask
Caden before shipping it. He's the vocab QA that matters.

## 6. Tone (cross-ref the Collide playbook)
Blunt, plain, short sentences. Talk about boring failures that cost real money
(missing tool, expired cert, unsigned ticket, photos lost in a camera roll).
Avoid: "excited to announce," "game-changing," "AI-powered revolution,"
"revolutionize," emoji walls. Confident, curious, operator-to-operator —
building *with* them, not pitching *at* them. (Full voice spec:
[`COLLIDE_PLAYBOOK.md`](./COLLIDE_PLAYBOOK.md).)

## 7. How to add a term
1. Add it to `lib/content/glossary.ts` (slug, category, def, **why it matters**,
   related). The "why" must tie to readiness — what it costs when missed.
2. If it's a finding category, map it in `CATEGORY_TO_SLUG` so the audit chip
   links to it.
3. Then use the term in UI/marketing/posts. Never ship a term that isn't in the
   glossary — the glossary is how we stay honest and consistent.
