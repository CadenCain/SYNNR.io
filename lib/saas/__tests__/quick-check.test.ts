import { describe, it, expect } from "vitest";
import { quickLines, quickKey, quickVerdict } from "../quick-check";

/**
 * The quick check: a short list per truck and job, "On truck" taps, one
 * photo, Ready. What a wireline yard's hand sees at 4:30 AM on CT-04.
 */
const kit = [{ label: "Lubricator", qty: 1 }, { label: "Sinker bars", qty: 4 }, { label: "BOP", qty: 1 }];
const plugSet = { name: "Plug set", lines: [{ label: "Setting tool", qty: 1 }, { label: "Plugs", qty: 2 }] };

describe("the list", () => {
  it("is the truck's list, then the job's, then what the manager planned", () => {
    const lines = quickLines({ kit, packages: [plugSet], planned: [{ label: "Extra pup joint", qty: 1 }] });
    expect(lines.map((l) => `${l.source}:${l.label}`)).toEqual([
      "kit:Lubricator", "kit:Sinker bars", "kit:BOP", "package:Setting tool", "package:Plugs", "plan:Extra pup joint",
    ]);
  });
  it("names a line the same on the phone and the server, and keeps a kit line apart from a job line with the same name", () => {
    const a = quickKey({ label: "Plugs ", source: "kit" });
    const b = quickKey({ label: "plugs", source: "package", package: "Plug set" });
    expect(a).toBe("kit||plugs");
    expect(b).toBe("package|Plug set|plugs");
    expect(a).not.toBe(b);
  });
});

describe("READY or NOT READY", () => {
  const all = (n: (q: number) => number) => kit.map((l) => ({ label: l.label, qty: l.qty, n: n(l.qty) }));
  it("everything on, the check tapped, the photo in: READY", () => {
    expect(quickVerdict({ lines: all((q) => q), notTapped: [], needPhoto: false, empty: false })).toEqual({ verdict: "ready", reasons: [] });
  });
  it("names what's missing in plain words", () => {
    const lines = [{ label: "Lubricator", qty: 1, n: 1 }, { label: "Sinker bars", qty: 4, n: 0 }, { label: "BOP", qty: 1, n: 0 }];
    const v = quickVerdict({ lines, notTapped: ["BOP rams closed for travel"], needPhoto: true, empty: false });
    expect(v.verdict).toBe("not_ready");
    expect(v.reasons).toEqual([
      "Not on the truck: Sinker bars (0 of 4)",
      "Not on the truck: BOP",
      "Not confirmed: BOP rams closed for travel",
      "No photo of the loaded truck",
    ]);
  });
  it("a truck with no list can't go READY: someone has to set it first", () => {
    const v = quickVerdict({ lines: [], notTapped: [], needPhoto: false, empty: true });
    expect(v.verdict).toBe("not_ready");
    expect(v.reasons[0]).toMatch(/no list yet/);
  });
});
