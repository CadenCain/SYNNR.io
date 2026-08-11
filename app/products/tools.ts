// The four tools — one engine, sliced by buyer. This file is the single
// source for the product pages; every capability line here must trace to the
// DOES list in CAPABILITIES.md. If it isn't there, it doesn't ship here.
// Anatomy copied from the proven vertical-SaaS pattern: one-line hero, a
// named-feature grid, cross-sell to the sibling tools, one CTA.

export type Tool = {
  slug: string;
  name: string; // display, e.g. "SYNNR Roll"
  question: string; // the one question the tool answers
  hero: string; // display headline
  lede: string;
  features: { name: string; desc: string }[];
  who: string;
  crossSell: string; // one line on how it feeds the others
};

export const TOOLS: Tool[] = [
  {
    slug: "roll",
    name: "SYNNR Roll",
    question: "Can this truck roll?",
    hero: "The truck rolls ready. Or it doesn't roll.",
    lede: "Every cert, DOT item, and crew card on the unit, checked live against the day the job actually runs. Built for the 5am call, not the monthly report.",
    features: [
      { name: "Job-date readiness check", desc: "Ask about Friday and it answers for Friday. A cert that's fine today but dead by the job fails now, in the yard — not on location." },
      { name: "No override button", desc: "The verdict is computed server-side. Nobody 'greens it up' on a tablet at the gate, and the check records who ran it and when." },
      { name: "An honest score", desc: "Readiness blends gear paper and crew cards from live records only. Anything expired, undated, or flagged missing caps the yard at 74%. Zero data reads 'not set up yet,' never 100%." },
      { name: "Warned before it lapses", desc: "A daily 6:30am sweep emails whoever you choose, routed by yard — the foreman who rolls that truck, not just the owner. Each item alerts once; renewing re-arms it." },
      { name: "Renew from the truck", desc: "Shoot the new cert with your phone, confirm the date it reads, done. The alert re-arms itself." },
    ],
    who: "Yard managers and dispatchers who sign off on what leaves the gate.",
    crossSell: "Roll reads crew cards from Cards and gear status from Yard — fix it in one place, every truck's verdict updates.",
  },
  {
    slug: "cards",
    name: "SYNNR Cards",
    question: "Are the hands' cards current?",
    hero: "Every hand current. Without the binder.",
    lede: "H2S, well control, CDL, medicals — one register for the whole crew, with a warning before anything lapses. No asset tracking required to use it.",
    features: [
      { name: "One register, every card", desc: "Crew members and their paper in one place, tracked the same way as gear paper: issued date, expiration date, status computed from today's date." },
      { name: "The lapse email", desc: "Daily sweep at 6:30am Central. Routed by yard so the right foreman hears about the right hand. Failed sends retry the next day." },
      { name: "The whole shop on one account", desc: "Owner, admin, and member roles. A hand can renew his own card from his phone. Priced per yard, never per seat — adding hands costs nothing." },
      { name: "Cards follow the truck", desc: "Assign a hand to a unit and his paper counts in that truck's readiness. An expired medical fails the truck, not just the man." },
      { name: "In by lunch", desc: "Drop a CSV from whatever spreadsheet you keep now, preview every row before anything is written, and export it all back out any time. Your data stays yours." },
    ],
    who: "Safety and HSE managers who just need the hands current.",
    crossSell: "Cards feeds Roll — an expired card fails the truck's readiness check the moment it lapses.",
  },
  {
    slug: "yard",
    name: "SYNNR Yard",
    question: "Where's the gear?",
    hero: "Stop calling the one guy who knows.",
    lede: "A register of what you own, with photos, and a note on where each piece was last seen — who said so, and how long ago. A note, not a tracker. It never lies about its own age.",
    features: [
      { name: "Last seen, in five seconds", desc: "Quick action from the phone: pick the gear, say where it is. 'Andrews yard, on 12, shop bench.' Searchable — 'Andrews' pulls everything last seen there." },
      { name: "A note that admits its age", desc: "Fresh, aging, or stale, right on the label. Nobody drives across town on a six-week-old guess dressed up as fact." },
      { name: "Flag it missing", desc: "Mark a piece missing and it fails its truck's readiness until somebody clears it. That's the honest version of 'nothing walks off.'" },
      { name: "Photos on the record", desc: "A picture of the actual BOP on the actual asset record, so the new hand knows what he's looking for." },
      { name: "The activity feed", desc: "Every sighting, renewal, and status change lands in the feed automatically — who, what, when." },
    ],
    who: "Shop foremen tired of being the one guy who knows.",
    crossSell: "Yard feeds Roll — gear flagged missing fails the truck it rides on until it's found or replaced.",
  },
  {
    slug: "proof",
    name: "SYNNR Proof",
    question: "Show the customer.",
    hero: "The audit packet that builds itself.",
    lede: "A live read-only link that shows an operator or auditor exactly what's current, right now. No binder, no scanning at 9pm the night before.",
    features: [
      { name: "One link, current forever", desc: "The proof shows live status, not a PDF snapshot that was stale the day after you sent it." },
      { name: "Read-only by construction", desc: "The customer sees status. They can't touch records, and the link shows exactly what you scoped it to." },
      { name: "Revoke any time", desc: "Every link you've created is listed in settings — see it, share it, kill it." },
      { name: "Backed by the same engine", desc: "Proof reads the same live records as Roll's readiness check. If the truck is green, the proof says why, line by line." },
      { name: "Bid with it", desc: "Send the link with the bid. An operator who can see your paper is current has one less reason to pick the other outfit." },
    ],
    who: "Anyone bidding work or sitting through an audit.",
    crossSell: "Proof is the outward face of Roll, Cards, and Yard — everything the other three keep current, this one shows off.",
  },
];

export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
