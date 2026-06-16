import type { Product } from "./types";

/**
 * The SYNNR app catalog. TallyShot ships now; the rest are coming-soon
 * (waitlist capture on /apps). Adding app #2 = adding an entry here, not a
 * rebuild — the marketplace, pricing math, and entitlement guard are generic.
 */
export const PRODUCTS: Product[] = [
  {
    slug: "tallyshot",
    name: "TallyShot",
    tagline: "Photograph a handwritten tally sheet, get clean Excel back — every shaky digit flagged.",
    status: "live",
    seatUnlocks: "One field hand or office user: unlimited logins, scan + review + Excel export.",
    pricing: {
      model: "hybrid",
      // per-seat with volume bands; pooled scan quota + overage on top
      bands: [
        { minSeats: 1, pricePerSeatUsd: 39, label: "1–9 seats" },
        { minSeats: 10, pricePerSeatUsd: 34, label: "10–24 seats" },
        { minSeats: 25, pricePerSeatUsd: 29, label: "25–49 seats" },
        { minSeats: 50, pricePerSeatUsd: 25, label: "50+ seats" },
      ],
      includedQuotaPerSeat: 10, // sheets / seat / month, pooled across the org. Deliberately tight: AI vision costs ~$0.05–0.10/sheet, so the $39 base covers the included scans ~50× over, and overage is where the per-user usage revenue + anti-sharing enforcement live.
      overagePerUnitUsd: 1.0, // $1 / extra sheet beyond the pool — ~93% margin and a real signal against shared logins
      unit: "sheet",
      trialDays: 14,
      selfServeMaxSeats: 49, // 50+ routes to "talk to us"
    },
  },
  {
    slug: "loadcheck",
    name: "LoadCheck",
    tagline: "Photo-verify the truck loadout before it rolls — nothing missing, nothing wrong.",
    status: "coming_soon",
    seatUnlocks: "Per-seat, coming soon.",
    pricing: { model: "per_seat", trialDays: 14 },
    problem:
      "A crew rolls out, gets to location, and the one tool they need is sitting in the yard. The trip's blown, the customer's waiting, and nobody can prove what was loaded.",
    bullets: [
      "Snap the loadout against the job's required-tools list",
      "Flags anything missing or wrong before the truck leaves",
      "A timestamped photo record of what actually went out",
    ],
  },
  {
    slug: "ticketflow",
    name: "TicketFlow",
    tagline: "Digital field tickets, auto-priced from your rate sheet, signed and billable same day.",
    status: "coming_soon",
    seatUnlocks: "Per-seat, coming soon.",
    pricing: { model: "per_seat", trialDays: 14 },
    problem:
      "Paper tickets sit in a truck for a week, get keyed in wrong, and come back from the operator kicked back for weak backup. Cash that should've billed Friday bills next month.",
    bullets: [
      "Build the ticket in the field, priced from your rate sheet",
      "Customer signs on the device — no lost paper",
      "Billable backup attached, same day, every time",
    ],
  },
  {
    slug: "certwatch",
    name: "CertWatch",
    tagline: "Cert and inspection expirations that block a job before it leaves the yard.",
    status: "coming_soon",
    seatUnlocks: "Per-seat, coming soon.",
    pricing: { model: "per_seat", trialDays: 14 },
    problem:
      "A hand's H2S card expired last week and nobody caught it until the operator's man on location did. Now the crew's sent home and the job's down — over a date in a spreadsheet nobody watches.",
    bullets: [
      "Tracks every cert and inspection expiration in one place",
      "Warns before a job that needs an expired cert is dispatched",
      "Reads new cards straight off a photo (TallyShot engine)",
    ],
  },
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function liveProducts(): Product[] {
  return PRODUCTS.filter((p) => p.status === "live");
}
