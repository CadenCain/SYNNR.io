# Spec — "Last seen" on an asset

**Status:** ready to build, NOT scheduled. Build it the day a paying customer
asks. Until then it stays here.

**What it is:** one more fact the register knows about a thing it already
tracks — where a piece of gear was last seen and who touched it. A note, not
a tracker.

**What it is not:** sign-out / return / reconciliation, scanning, GPS. That's
possession tracking and it stays cut. See CAPABILITIES.md.

---

## Why this shape

Four people asked for gear visibility (Bailey unprompted; Martin, JD,
Siddharth prompted). The expensive answer is a check-out workflow. The cheap
answer is a field. The field gets ~80% of the complaint ("can't tell who
grabbed it last") for ~5% of the build, and it doesn't turn RollReady back
into a checklist app.

Honest sales line: **"it's a note, not a tracker — it's only as good as
whoever updates it."** Say that out loud every time, and the claim stays true.

---

## THE RULE (non-negotiable)

**Last-seen data never affects the readiness verdict or the score.**

No stale note turns a truck red. No "not updated in N days" warning on the
readiness check. It is information for humans, never enforcement. The moment
it gates something, we have rebuilt the gear-list-as-gate bug we removed on
2026-07-28 — and this time on data that goes stale by design.

The one existing gear signal that DOES fail a truck stays exactly as it is:
an asset a human has explicitly flagged `missing` / `out_of_service`. That is
a deliberate statement, not a stale timestamp.

---

## Data

`saas_assets` already has `last_seen_at` (unused, from the original build).
Add two columns:

| column | type | note |
|---|---|---|
| `last_seen_at` | timestamptz | already exists — start writing it |
| `last_seen_where` | text | free text. "Andrews yard", "on 12", "shop bench" |
| `last_seen_by` | text | name typed by whoever updates, same pattern as `performed_by_name` on checks |

Free text on purpose. A dropdown of yards forces a taxonomy nobody agreed to
and gear lives in places that aren't yards (a vendor, a shop, a hot-shot
truck). Let them write it.

History: write a `saas_events` row on every change (kind `asset_seen`,
message `"BOP #3 — Andrews yard, per Dusty"`). The activity feed already
renders events, so history is free and it shows up on the dashboard.

RLS: same company-scoped policy as the rest of `saas_assets`. No new
tenancy surface.

---

## UI — three places, all small

**1. Asset row / asset page — the fact**
Show under the name: `Last seen: Andrews yard · Dusty · Jul 26`
Muted, one line. If never set: `Last seen: not recorded` (not an error state,
not a nag).

**2. The edit — a 5-second phone flow**
Tap it → two inputs (where, who) → Save. Prefill `who` with the signed-in
user's name so it's usually one tap and one word.

**3. Quick action (the mobile FAB) — a third mode**
Alongside "Renew a cert" and "Add a cert", add **"Where's something"**.
Pick asset → type where → Save. This is the one that gets used, because it's
the flow a hand actually has time for standing in the yard.

Also: make `last_seen_where` searchable in `/app/search`, so "Andrews" pulls
everything last seen there. Cheap, and it's how someone will actually use it.

---

## Not in v1

- No required-update cadence, no "stale" badges, no nagging
- No effect on readiness, score, or check verdict (see THE RULE)
- No scanning, no location picker, no map
- No per-asset history page — the activity feed covers it

If a paying customer asks for any of the above, that's a new conversation
with evidence attached.

---

## Effort

About a day: one migration, one server action, three small UI touches, one
Quick mode. No engine changes — which is the point.

## Copy that becomes true once it ships

- ✅ "one place that says where a tool was last seen and who touched it"
- ✅ "it's a note, not a tracker"
- ❌ still never: "know where all your gear is", "who signed it out",
  "whether it came back"
