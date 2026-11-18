import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkPages, type DocKind } from "./brain";

/**
 * The demo company's documents. Every word is made up: the customer, the
 * rates, the procedures and the notes belong to no real shop. They're here
 * so someone trying SYNNR can ask a question and see it answered from a
 * document, with the passage it came from. The demo says so on every screen.
 */
export const SAMPLE_DOCS: { title: string; kind: DocKind; managers_only?: boolean; text: string }[] = [
  {
    title: "MSA: Dry Creek Operating (sample)",
    kind: "contract",
    text: `MASTER SERVICE AGREEMENT (SAMPLE)
Between Caprock Coil & Pressure Control ("Contractor") and Dry Creek Operating ("Company"). This is a made-up agreement for the SYNNR demo.

4. Rates and Invoicing
Work is billed at the rates on Contractor's current price sheet unless this agreement sets a different rate. Every field ticket must be signed by Company's representative on location before the crew leaves. Invoices are sent within 10 days of the job and are due net 45 from the invoice date. Company will not pay a ticket that has no signature.

7. Standby
The first two hours of waiting on Company at location are not charged. After that, standby is billed at $185.00 per hour for each unit, in half-hour steps. Standby time must be written on the field ticket and signed by Company's representative. Waiting caused by Contractor's own equipment is not standby and is not billed.

8. Cancellation
A job cancelled less than 12 hours before its start time is billed a $1,500.00 mobilization charge. A job cancelled after the crew has arrived on location is billed a four-hour minimum at the unit's hourly rate, plus mileage both ways.

9. Requirements on Location
Everyone on Contractor's crew carries a current H2S certificate and a fit test dated within the last 12 months. Flame-resistant clothing is worn at all times inside the location. A job safety analysis is held with Company's representative before rig-up. Anyone on location can stop the work.

10. Pressure Testing
Before any tool goes in the hole, pressure control equipment is tested low and high, and the test is recorded on a chart or a digital recorder. The record is handed to Company's representative before the run starts. Company can refuse to start a run with no test record.

14. Lost or Damaged Equipment
Equipment lost or damaged in the hole through no fault of Contractor is paid for by Company at replacement cost, less 10 percent for each year in service, to a floor of 50 percent.`,
  },
  {
    title: "Price sheet 2026 (sample)",
    kind: "pricing",
    text: `PRICE SHEET 2026 (SAMPLE)
Caprock Coil & Pressure Control. Made-up rates for the SYNNR demo. A customer's own agreement can set a different rate, and when it does, the agreement wins.

Coil tubing unit
2 in. coil unit with crew of four: $14,500.00 per day, 12 hours on location. Hours past 12 are $950.00 per hour.

Pressure control
Pump-down package: $3,200.00 per day. Lubricator, per 10 ft section: $180.00 per day. BOP, 5-1/8 in. 10K: $650.00 per day. Each pressure test recorded for the customer: no charge.

Standby
Standby is $225.00 per hour for each unit after the first hour on location, unless the customer's agreement says otherwise.

Mileage and travel
Mileage is $4.25 per mile for each unit, one way, from the yard. Crew travel time over two hours each way is $65.00 per man-hour.

Other charges
Per diem: $165.00 per man per night away from the yard. Nitrogen and chemicals are billed at cost plus 15 percent. A ticket with no customer signature is not billed until the office has called the customer.`,
  },
  {
    title: "Pressure control: rig-up and test, SOP-PC-01 (sample)",
    kind: "procedure",
    text: `PRESSURE CONTROL: RIG-UP AND TEST (SAMPLE)
SOP-PC-01. A made-up procedure for the SYNNR demo. It is not a real procedure and must not be used as one.

Before leaving the yard
Check the wellhead flange size and pressure rating on the dispatch against the BOP and adapter flange on the truck. If they don't match, stop and call the office before you roll. Carry two spare ring gaskets for the flange on the job. Confirm the test pump, chart recorder and a fresh chart are on the truck.

On location
1. Hold the job safety analysis with the company man before anything comes off the truck.
2. Spot the unit upwind of the wellhead, with a clear way out.
3. Check the wellhead for pressure and confirm the master valve is closed before removing the cap.
4. Make up the adapter flange with a new ring gasket. Never reuse a ring gasket.
5. Function test the BOP rams, open and closed, before stabbing on.

Pressure test
Test low first: 250 psi for 5 minutes. Then test high to the pressure on the job sheet for 10 minutes. No visible leaks and no drop on the chart. Record both on the chart, write the well name and date on it, and hand it to the company man before the first run. If a connection leaks, bleed to zero before touching it, then test again from the start.

Rig-down
Bleed all pressure to zero and confirm it at the gauge. Close the BOP rams for travel. Cap the wellhead before the unit moves.`,
  },
  {
    title: "After the job: wash and put-away, SOP-YD-03 (sample)",
    kind: "procedure",
    text: `AFTER THE JOB: WASH AND PUT-AWAY (SAMPLE)
SOP-YD-03. A made-up procedure for the SYNNR demo.

Before anyone goes home
The job isn't done until the equipment is ready for the next one. Wash the pressure control package the same day, including the inside of the lubricator and the BOP body. Mud left overnight sets up and costs a full day to chip out.

BOP
Close the rams for travel and leave them closed in the yard. Grease the ram shafts. Look at the ram rubbers: any cut, flat spot or swelling gets written on the ticket and the BOP gets a red tag.

What gets restocked
O-rings and ring gaskets used on the job are replaced from the parts room before the truck is parked. Chart paper and pens go back in the recorder box.

Damage
Anything bent, leaking or washed out is tagged red and written up the same day, with a photo. The next crew should never find it at 4 AM.`,
  },
  {
    title: "Post-job report: pump-down, Dry Creek (sample)",
    kind: "report",
    text: `POST-JOB REPORT (SAMPLE)
Pump-down package for Dry Creek Operating. A made-up report for the SYNNR demo.

What happened
Arrived on location at 5:10 AM. The frac crew was behind, so the unit waited 5 hours before rig-up. Standby was billed for 3 hours, after the two free hours in the Dry Creek agreement, and the company man signed for it on the ticket.

What went wrong
On the high test, a 2 in. 1502 Chiksan swivel leaked at 4,200 psi. Bled to zero, swapped it for the spare, and tested again from the start. Lost 40 minutes. The swivel was red-tagged and went to the shop.

What to do next time
Carry two spare swivels on a pump-down job, not one. Ask dispatch the night before whether the frac crew is on schedule.`,
  },
  {
    title: "Things nobody wrote down (sample)",
    kind: "note",
    text: `Shop notes. Made up for the SYNNR demo.

Dry Creek's company men want the pressure test chart in their hand before the first run. If you can't find the chart, they will shut you down until you test again.

The rebuilt 2 in. 1502 plug valves are on the blue rack. The ones on the gray rack are waiting on parts. Don't load from the gray rack.

After a rain, the lease roads east of the yard turn to gumbo. Take the 4x4 pickup as the lead vehicle and call the office before you leave the pavement.

Always count the pup joints going on and coming off. We left two on a location last year and paid for them.`,
  },
];

/** What a visitor can ask the demo and get an answer to. */
export const SAMPLE_QUESTIONS = [
  "What do we charge for standby?",
  "What does the Dry Creek MSA say about cancelling a job?",
  "What do we test the BOP to before the first run?",
  "What goes on a pump-down package?",
];

/** Load the samples into a new demo company. A sample that fails to load never stops the demo from opening. */
export async function seedBrainSamples(admin: SupabaseClient, companyId: string): Promise<void> {
  try {
    const { data, error } = await admin.from("synnr_docs").insert(SAMPLE_DOCS.map((d) => ({
      company_id: companyId, title: d.title, kind: d.kind, origin: "sample", status: "ready",
      chars: d.text.length, managers_only: Boolean(d.managers_only), added_by_name: "SYNNR (sample)",
    }))).select("id, title");
    if (error) throw new Error(error.message);
    const ids = new Map(((data ?? []) as { id: string; title: string }[]).map((r) => [r.title, r.id]));
    const rows = SAMPLE_DOCS.flatMap((d) => chunkPages([d.text], false).map((p) => ({
      doc_id: ids.get(d.title)!, company_id: companyId, idx: p.idx, doc_title: d.title, section: p.section, page: p.page, body: p.body,
    })));
    const { error: chunkErr } = await admin.from("synnr_doc_chunks").insert(rows);
    if (chunkErr) throw new Error(chunkErr.message);
  } catch (e) {
    console.error("[demo] sample documents:", e instanceof Error ? e.message : e);
  }
}
