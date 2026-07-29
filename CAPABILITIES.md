# RollReady — what it actually does

**This file is the source of truth for every capability claim: marketing copy,
DMs, posts, sales calls, agent instructions.** If a claim isn't on the DOES
list below, it can't be said in public. Verified against the code, not memory
(engine audit 2026-07-27).

RollReady is the product. SYNNR is the company. `synnr.io`. $500 per yard per
month. Setup is optional: $750 remote / $1,500 onsite for the first yard.

---

## DOES (safe to claim, today)

**Says where the gear was last seen.** (shipped 2026-07-29)
- A location note on any asset: where it was last seen, who said so, when.
- Updated in ~5 seconds from the phone (Quick action -> "Where's something").
- Searchable — "Andrews" pulls everything last seen there.
- History lands in the activity feed automatically.
- It is a NOTE, not a tracker. Only as good as whoever updates it, and it
  NEVER affects a truck's ready call. Say that out loud when selling it.

**Works for the whole shop, not one login.**
- One company account; invite the crew (owner / admin / member roles).
- A hand can update where gear is, renew a cert, and run a readiness check.
- Only owner/admin can add or delete trucks, or bulk import.
- Priced per YARD, never per seat — adding hands costs nothing.

**Keeps one register of the stuff that expires.**
- Assets/gear per truck and yard, with a status you set by hand
  (in service / out of service / missing).
- Certs, inspections, and DOT items on units and on assets, with issued and
  expiration dates.
- Crew members and their cards (H2S, well control, CDL, medical), tracked
  the same way as gear paper.

**Getting your stuff in doesn't take a week.** (shipped 2026-07-29)
- Bulk: drop a CSV file on the import page, or paste it. Dry-run preview shows
  every row and every error before anything is written. Re-importing updates
  dates instead of duplicating.
- One at a time from the phone (Quick action): add a truck or rig, add gear to
  a truck, add a cert. First truck also starts the yard, so a guy standing in
  the yard on day one can get going without a desktop.
- Everything is exportable back out as CSV any time, from Settings.

**Tells you before something lapses.**
- Daily sweep, 6:30am Central. Emails the recipients you choose — routed by
  yard, so the foreman who rolls that truck gets it, not just the owner.
- Each item alerts once; renewing re-arms it. Failed sends retry next day.
- With no setup at all, alerts go to the signup email.

**Answers "can this truck roll?" on demand.**
- The readiness check: every cert/DOT item on the unit and its assets, every
  assigned hand's cards, checked live — and **against a future job date**, so
  a cert that's fine today but lapses before Friday's job fails Friday's check.
- Verdict is computed server-side. No override button.
- Records who ran the check and when, read-only afterward.

**Proves it to an operator.**
- A read-only proof link showing current status. No binder.

**Scores it honestly.**
- Readiness % = 70% gear paperwork + 30% crew cards, from live records only.
- Anything expired, undated, or flagged missing caps it at 74%. Zero data
  reads "Not set up yet," never 100%.

---

## DOES NOT (never claim, no matter how the sentence is worded)

**Possession tracking.** This is the one that keeps creeping back in.
- ❌ who signed a tool out
- ❌ whether it came back
- ❌ "who's got it right now" / "where it is"
- ❌ sign-out / return / reconciliation flows
- ❌ QR or RFID scanning
- ❌ GPS or telematics of any kind

Nearest true statements: *"it records who ran the last readiness check"*,
*"you can flag an asset missing and it fails the truck until you clear it"*,
and now *"it says where the gear was last seen and who touched it."*
None of those is a sign-out system and they must not be stretched into one.
"Last seen" is a note somebody typed, not a chain of custody.

**Also not built:** SMS alerts (needs Twilio; email is the live channel),
automatic cert reading from a photo without a human confirming the date,
invoicing, dispatch/scheduling, inventory counts, purchasing.

---

## Vocabulary

RollReady keeps up with everybody's records. It is **not** a dispatching app
and not a checklist app — the founder rejected that framing outright, and the
product was rebuilt to match.

| Say | Never say |
|---|---|
| readiness check | pre-dispatch check |
| gear list (a reference) | loadout checklist (a gate) |
| check record | dispatch record |
| keeps up with / tracks | dispatches / assigns |

The gear list **warns**, it never fails a truck. Only real record problems
fail a truck: expired paper, a card with no date on file, gear flagged
missing.

---

## Demand log rule

A capability request counts as market demand only if it is **unprompted**.
Someone agreeing with a feature we described first is our own copy reflected
back, not evidence. Possession tracking currently has **one** clean signal
(Bailey, 2026-07-14, unprompted). Build it when a paying customer asks for it,
not before.
