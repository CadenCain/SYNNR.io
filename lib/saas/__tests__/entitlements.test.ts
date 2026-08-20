import { describe, it, expect } from "vitest";
import { yardCapState, canLowerAllowance, isWritable, canPerform } from "../entitlements";

/**
 * The owner's entitlement decisions, pinned. Spec 2026-08-19: hard cap on
 * yards (no silent bill changes), read-only on lapse (never locked out),
 * three roles with exactly the matrix below.
 */

describe("yardCapState — the hard cap", () => {
  it("under the cap: create freely, no dialog", () => {
    expect(yardCapState(1, 2, false)).toEqual({ atCap: false, remaining: 1 });
  });

  it("at the cap: refused (pick 2, pay 2, the 3rd waits for the plan)", () => {
    expect(yardCapState(2, 2, false).atCap).toBe(true);
  });

  it("over the cap (legacy drift): still at cap, remaining clamps to 0", () => {
    expect(yardCapState(5, 3, false)).toEqual({ atCap: true, remaining: 0 });
  });

  it("allowance 0 (never subscribed): the first yard is already refused", () => {
    expect(yardCapState(0, 0, false).atCap).toBe(true);
  });

  it("comped bypasses the cap entirely", () => {
    expect(yardCapState(50, 0, true)).toEqual({ atCap: false, remaining: Infinity });
  });
});

describe("canLowerAllowance — never auto-delete a yard to satisfy a downgrade", () => {
  it("dropping below yards-in-use is refused with the delete-first message", () => {
    const r = canLowerAllowance(3, 5);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Delete 2");
  });

  it("dropping to exactly in-use is allowed", () => {
    expect(canLowerAllowance(5, 5).ok).toBe(true);
  });

  it("floor of one yard", () => {
    expect(canLowerAllowance(0, 0).ok).toBe(false);
  });
});

describe("isWritable — lapsed is read-only, never locked out", () => {
  it("active writes; everything else is read-and-export only", () => {
    expect(isWritable("active", false)).toBe(true);
    expect(isWritable("past_due", false)).toBe(false); // owner's call: fix the card first
    expect(isWritable("canceled", false)).toBe(false);
    expect(isWritable("none", false)).toBe(false);
  });

  it("comped is always writable regardless of status", () => {
    expect(isWritable("none", true)).toBe(true);
  });
});

describe("canPerform — the role matrix, spot-pinned at every boundary", () => {
  it("members do the daily work", () => {
    for (const a of ["run_check", "renew", "add_record", "update_location", "create_proof", "export", "import_existing_yard"] as const) {
      expect(canPerform("member", a)).toBe(true);
    }
  });

  it("members never destroy, never manage, never touch money", () => {
    for (const a of ["delete_record", "create_yard", "delete_yard", "import_new_yard", "manage_team", "revoke_proof", "billing"] as const) {
      expect(canPerform("member", a)).toBe(false);
    }
  });

  it("admins destroy and manage but never touch money or the crown", () => {
    expect(canPerform("admin", "delete_record")).toBe(true);
    expect(canPerform("admin", "create_yard")).toBe(true);
    expect(canPerform("admin", "manage_team")).toBe(true);
    expect(canPerform("admin", "billing")).toBe(false);
    expect(canPerform("admin", "transfer_ownership")).toBe(false);
  });

  it("owner does everything", () => {
    expect(canPerform("owner", "billing")).toBe(true);
    expect(canPerform("owner", "transfer_ownership")).toBe(true);
    expect(canPerform("owner", "delete_yard")).toBe(true);
  });
});
