/**
 * Module 2 — Digital Yard Twin finite state machine. Assets move between a
 * strict set of operational states; transitions are validated here so the twin
 * can't be put into an impossible state. "Loadout readiness" (Ready/At Risk/
 * Blocked) is a SEPARATE computed verdict — see loadoutStatus().
 */
export const ASSET_STATES = [
  "yard_available",
  "staged_for_loadout",
  "loaded_verified",
  "dispatched_active",
  "maintenance_required",
] as const;
export type AssetState = (typeof ASSET_STATES)[number];

export const STATE_LABEL: Record<AssetState, string> = {
  yard_available: "Yard · available",
  staged_for_loadout: "Staged for loadout",
  loaded_verified: "Loaded · verified",
  dispatched_active: "Dispatched · active",
  maintenance_required: "Maintenance required",
};

/** Visual tone for the schematic dashboard. */
export const STATE_TONE: Record<AssetState, "green" | "amber" | "active" | "red"> = {
  yard_available: "green",
  loaded_verified: "green",
  staged_for_loadout: "amber",
  dispatched_active: "active",
  maintenance_required: "red",
};

/** Legal next states from each state. */
export const VALID_TRANSITIONS: Record<AssetState, AssetState[]> = {
  yard_available: ["staged_for_loadout", "maintenance_required"],
  staged_for_loadout: ["loaded_verified", "yard_available", "maintenance_required"],
  loaded_verified: ["dispatched_active", "staged_for_loadout", "maintenance_required"],
  dispatched_active: ["yard_available", "maintenance_required"],
  maintenance_required: ["yard_available"],
};

export function canTransition(from: AssetState, to: AssetState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Short action labels for the buttons that drive each legal transition. */
export const TRANSITION_LABEL: Record<AssetState, string> = {
  yard_available: "Return to yard",
  staged_for_loadout: "Stage for loadout",
  loaded_verified: "Mark loaded & verified",
  dispatched_active: "Dispatch",
  maintenance_required: "Send to maintenance",
};

export function isAssetState(v: string): v is AssetState {
  return (ASSET_STATES as readonly string[]).includes(v);
}

const DAY = 86_400_000;
/** Days until a date (negative = past). null when no date. */
export function daysUntil(d: string | null): number | null {
  if (!d) return null;
  return Math.floor((new Date(d).getTime() - Date.now()) / DAY);
}

export type Readiness = "ready" | "at_risk" | "blocked";

/**
 * Loadout/inspection readiness for a truck node, given its child items and dates.
 * Blocked = a required item missing or an inspection/calibration expired.
 * At risk = something due within 14 days. Ready otherwise.
 */
export function loadoutStatus(args: {
  childMissing: number;
  inspectionDays: number | null; // days until the truck's own inspection
  childSoonest: number | null; // soonest child calibration/inspection days
}): { status: Readiness; reason: string } {
  const { childMissing, inspectionDays, childSoonest } = args;
  if (childMissing > 0) return { status: "blocked", reason: `${childMissing} required item${childMissing === 1 ? "" : "s"} missing` };
  if (inspectionDays != null && inspectionDays < 0) return { status: "blocked", reason: "Inspection expired" };
  if (childSoonest != null && childSoonest < 0) return { status: "blocked", reason: "A tool's calibration is expired" };
  const soon = [inspectionDays, childSoonest].filter((d): d is number => d != null && d >= 0);
  const min = soon.length ? Math.min(...soon) : null;
  if (min != null && min <= 14) return { status: "at_risk", reason: `Inspection/calibration due in ${min} day${min === 1 ? "" : "s"}` };
  return { status: "ready", reason: "Cleared for dispatch" };
}
