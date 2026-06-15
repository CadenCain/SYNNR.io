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
      includedQuotaPerSeat: 500, // sheets / seat / month, pooled across the org
      overagePerUnitUsd: 0.05,
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
  },
  {
    slug: "ticketflow",
    name: "TicketFlow",
    tagline: "Digital field tickets, auto-priced from your rate sheet, signed and billable same day.",
    status: "coming_soon",
    seatUnlocks: "Per-seat, coming soon.",
    pricing: { model: "per_seat", trialDays: 14 },
  },
  {
    slug: "certwatch",
    name: "CertWatch",
    tagline: "Cert and inspection expirations that block a job before it leaves the yard.",
    status: "coming_soon",
    seatUnlocks: "Per-seat, coming soon.",
    pricing: { model: "per_seat", trialDays: 14 },
  },
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function liveProducts(): Product[] {
  return PRODUCTS.filter((p) => p.status === "live");
}
