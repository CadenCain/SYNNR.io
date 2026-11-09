import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * The load-out phone, from the busy-week findings:
 *   - Typing a serial is forgiving (dashes, spaces, case, the last 4) and
 *     never guesses between two pieces. Shared with check-in.
 *   - A draft the server can never take isn't offered, and picking it up
 *     doesn't buy it more time.
 *   - A red piece left on the truck has no default answer; a flagged-missing
 *     one isn't asked about.
 *   - "Grab one from here" offers only iron a hand can grab, nearest first,
 *     and a truck's own still-out iron comes before anyone else's.
 *   - A plan or kit changed while the screen was open catches up after a save.
 *   - A truck out on a job asks "It's back in the yard" before Start.
 *   - Truck paper that blocks shows before loading.
 *   - An NFC phone in a yard with no tags checks pieces off like an iPhone.
 */

vi.mock("@/app/app/units/[unitId]/scan/actions", () => ({
  finishLoadout: vi.fn(async () => ({ ok: false })),
  linkTag: vi.fn(async () => ({ ok: true })),
}));

import { findBySerial, serialMiss } from "@/app/app/_components/serial-check";
import { loadoutDraftSendable } from "@/app/app/_components/unsent-drafts";
import { notScannedFor, needsAnswer, grabRank, grabbable, planCatchUp, kitChecksFrom, type PhonePiece } from "@/app/app/units/[unitId]/scan/scan-phone";
import LoadoutScanner from "@/app/app/units/[unitId]/scan/scanner";

const piece = (id: string, name: string, serial: string | null, unitId: string | null, extra: Partial<PhonePiece> = {}): PhonePiece => ({
  id, name, serial, unitId, where: unitId ?? "Odessa Yard", spot: null, category: "pressure_control",
  tagKey: "", extKey: null, problem: null, statusText: "Test good to Mar 3, 2027", ...extra,
});

describe("typing a serial", () => {
  const pieces = [
    piece("db", "Double BOP", "DB-2210", null),
    piece("pv1", "2in plug valve", "PV-2201", "ct01"),
    piece("pv2", "2in plug valve", "PV-12201", "ct02"),
    piece("sw", "Swivel", "SW-1101", "ct01"),
    piece("none", "Hose", null, null),
  ];

  it("DB2210, db 2210 and DB-2210 all find DB-2210", () => {
    for (const t of ["DB2210", "db 2210", "DB-2210", " db-2210 "]) expect(findBySerial(pieces, t)).toEqual({ piece: pieces[0] });
  });

  it("the last 4 or more find the one piece that ends that way", () => {
    expect(findBySerial(pieces, "2210")).toEqual({ piece: pieces[0] });
    expect(findBySerial(pieces, "1101")).toEqual({ piece: pieces[3] });
  });

  it("never guesses: two pieces that end the same ask for more", () => {
    const hit = findBySerial(pieces, "2201");
    expect(hit && "many" in hit ? hit.many.map((p) => p.id) : hit).toEqual(["pv1", "pv2"]);
    expect(serialMiss("2201", hit as { many: PhonePiece[] })).toBe("More than one piece matches 2201: PV-2201, PV-12201. Type the whole serial off the stamp.");
    // The whole serial picks the one.
    expect(findBySerial(pieces, "pv2201")).toEqual({ piece: pieces[1] });
  });

  it("3 characters or fewer, or a stamp nobody has, finds nothing", () => {
    expect(findBySerial(pieces, "210")).toBeNull();
    expect(findBySerial(pieces, "XB2210")).toBeNull();
    expect(findBySerial(pieces, "--")).toBeNull();
    expect(serialMiss("XB2210", null)).toBe("No piece with serial XB2210. Check the stamp and try again.");
  });

  it("a whole serial wins over one that only ends with it, and dash-only twins go by how it was typed", () => {
    const more = [...pieces, piece("short", "Crossover", "2210", null)];
    expect(findBySerial(more, "2210")).toEqual({ piece: more[5] });
    const twins = [piece("a", "Valve", "PV-3019", null), piece("b", "Valve", "PV3019", null)];
    expect(findBySerial(twins, "pv3019")).toEqual({ piece: twins[1] });
    const hit = findBySerial(twins, "PV 3019");
    expect(hit && "many" in hit ? hit.many.length : 0).toBe(2);
  });
});

describe("a draft the server can't take", () => {
  const H = 3600e3;
  const now = Date.parse("2026-11-12T04:00:00Z");
  const scans = { a: { how: "hand", at: 1 } };

  it("fresh: offered", () => {
    expect(loadoutDraftSendable({ scans, savedAt: now - 2 * H, startedAt: new Date(now - 3 * H).toISOString() }, now)).toBe(true);
  });

  it("started more than 20 hours ago: not offered, even if it was picked up an hour ago", () => {
    expect(loadoutDraftSendable({ scans, savedAt: now - 1 * H, startedAt: new Date(now - 21 * H).toISOString() }, now)).toBe(false);
  });

  it("not worked on in 18 hours, or nothing scanned: not offered", () => {
    expect(loadoutDraftSendable({ scans, savedAt: now - 19 * H, startedAt: new Date(now - 19.5 * H).toISOString() }, now)).toBe(false);
    expect(loadoutDraftSendable({ scans: {}, savedAt: now, startedAt: new Date(now).toISOString() }, now)).toBe(false);
    expect(loadoutDraftSendable(null, now)).toBe(false);
  });
});

describe("what the phone sends for pieces that didn't get scanned", () => {
  const red = piece("pv31", "2in plug valve", "PV-2231", "ct06", { problem: "red", statusText: "UT: expired Oct 30" });
  const ok = piece("sw", "Swivel", "SW-1106", "ct06");
  const gone = piece("pv07", "2in plug valve", "PV-2207", "ct06", { missing: true });

  it("a red piece nobody answered for isn't sent (the server blocks it as not scanned), and isn't taken off by default", () => {
    expect(needsAnswer(red, {})).toBe(true);
    expect(notScannedFor([red, ok, gone], {}, {})).toEqual([{ assetId: "sw", outcome: "yard" }]);
  });

  it("once the hand says what happened, it goes", () => {
    expect(needsAnswer(red, { pv31: "yard" })).toBe(false);
    expect(notScannedFor([red, ok], {}, { pv31: "yard", sw: "missing" })).toEqual([{ assetId: "pv31", outcome: "yard" }, { assetId: "sw", outcome: "missing" }]);
  });

  it("a piece already flagged missing isn't asked about, whatever the phone has for it", () => {
    expect(notScannedFor([gone], {}, { pv07: "yard" })).toEqual([]);
  });

  it("scanned pieces aren't in it", () => {
    expect(notScannedFor([red, ok], { pv31: {}, sw: {} }, {})).toEqual([]);
  });
});

describe("Grab one from here", () => {
  it("only iron a hand can grab: not out on a job, not signed out, not missing, not red, not on this truck", () => {
    expect(grabbable(piece("a", "Swivel", "S1", null), "ct07")).toBe(true);
    expect(grabbable(piece("b", "Swivel", "S2", "ct02", { out: true }), "ct07")).toBe(false);
    expect(grabbable(piece("c", "Swivel", "S3", null, { missing: true }), "ct07")).toBe(false);
    expect(grabbable(piece("d", "Swivel", "S4", null, { problem: "red" }), "ct07")).toBe(false);
    expect(grabbable(piece("e", "Swivel", "S5", "ct07"), "ct07")).toBe(false);
  });

  it("this yard's racks, then trucks parked here, then other yards", () => {
    const list = [
      piece("far-truck", "Swivel", "S1", "ct09"),
      piece("far-rack", "Swivel", "S2", null),
      piece("near-truck", "Swivel", "S3", "ct03", { near: true }),
      piece("near-rack", "Swivel", "S4", null, { near: true }),
    ];
    expect([...list].sort((x, y) => grabRank(x) - grabRank(y)).map((p) => p.id)).toEqual(["near-rack", "near-truck", "far-rack", "far-truck"]);
  });
});

describe("a plan changed while the screen was open", () => {
  const shown = { id: "plan-1", by: "Kevin", at: "Nov 12, 4:00 AM", job: "University 7-12 #3H", packageIds: ["pump-down"], lines: [] };

  it("the old plan's package comes off, the new one's is locked on, and the hand is told", () => {
    const c = planCatchUp({ shown, locked: ["pump-down"], packageIds: ["pump-down", "extra"], known: ["pump-down", "frac", "extra"],
      server: { id: "plan-1", atText: "Nov 12, 5:10 AM", by: "Kevin", job: "University 7-12 #4H", packageIds: ["frac"], lines: [{ label: "Swivel", qty: 1 }] } });
    expect(c.packageIds).toEqual(["extra", "frac"]);
    expect(c.locked).toEqual(["frac"]);
    expect(c.dropped).toEqual(["pump-down"]);
    expect(c.plan).toMatchObject({ job: "University 7-12 #4H", at: "Nov 12, 5:10 AM", lines: [{ label: "Swivel", qty: 1 }] });
    expect(c.note).toBe("Kevin changed the plan Nov 12, 5:10 AM. This is the new list.");
  });

  it("cleared: everything it locked comes off", () => {
    const c = planCatchUp({ shown, locked: ["pump-down"], packageIds: ["pump-down"], known: ["pump-down"], server: null });
    expect(c).toMatchObject({ packageIds: [], locked: [], plan: null, note: "The plan for this truck was cleared. This is the list now." });
  });

  it("the same plan: nothing to say", () => {
    const c = planCatchUp({ shown, locked: ["pump-down"], packageIds: ["pump-down"], known: ["pump-down"],
      server: { id: "plan-1", atText: "Nov 12, 4:00 AM", by: "Kevin", job: "University 7-12 #3H", packageIds: ["pump-down"], lines: [] } });
    expect(c.note).toBeNull();
    expect(c.packageIds).toEqual(["pump-down"]);
  });

  it("planned after the screen opened", () => {
    const c = planCatchUp({ shown: null, locked: [], packageIds: [], known: ["frac"],
      server: { id: "plan-2", atText: "Nov 12, 5:10 AM", by: null, job: null, packageIds: ["frac"], lines: [] } });
    expect(c.note).toBe("A manager planned this job Nov 12, 5:10 AM. This is the new list.");
    expect(c.packageIds).toEqual(["frac"]);
  });
});

describe("a kit check renamed while the screen was open", () => {
  it("the kit's own checks come back with the new name, not the packages'", () => {
    expect(kitChecksFrom(["BOP rams closed and locked for travel", "Pump-down lines bled off"], [["Pump-down lines bled off"]]))
      .toEqual(["BOP rams closed and locked for travel"]);
  });
});

describe("the load-out screen", () => {
  const truck = { id: "ct01", name: "CT-01" };
  const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(LoadoutScanner, {
    truck, pieces: [], kit: [], packages: [], ...props,
  } as Parameters<typeof LoadoutScanner>[0]));
  const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ");

  it("a truck out on a job asks first, and there's no Start until the hand says it's back", () => {
    const html = text(render({ truckOut: { since: "2026-11-10T11:10:00Z", sinceText: "Nov 10, 5:10 AM", by: "Manuel Ortega" } }));
    expect(html).toContain("CT-01 is out on a job since Nov 10, 5:10 AM, loaded by Manuel Ortega. Only load it out once it's back in the yard.");
    expect(html).toContain("To log a piece sent out to it, use Move it on that piece.");
    expect(html).toContain("It's back in the yard");
    expect(html).not.toContain("Start scanning");
    expect(html).not.toContain("Start loading");
    expect(text(render({}))).toMatch(/Start (scanning|loading)/);
  });

  it("truck paper that blocks shows before loading", () => {
    const html = text(render({ truckPaper: [{ title: "Annual DOT inspection", detail: "expired Oct 17 (23d ago)" }] }));
    expect(html).toContain("CT-01 can't roll: Annual DOT inspection expired Oct 17 (23d ago).");
    expect(html).toContain("Only a manager can clear this.");
  });

  it("the truck's own iron marked still out shows on its line first, not 'No good ... anywhere'", () => {
    const pieces = [
      piece("qb69", "Quad BOP stack #1", "QB-4469", "ct01", { out: true }),
      piece("qb70", "Quad BOP stack #2", "QB-4470", "ct02", { near: true }),
      piece("lb", "Lubricator #1", "LB-811", "ct01", { out: true }),
    ];
    const html = text(render({ pieces, stillOutIds: ["qb69", "lb"], kit: [{ label: "Quad BOP stack", qty: 1 }, { label: "Lubricator", qty: 1 }], initialScans: {} }));
    expect(html).toContain("Marked still out at the last check-in. On CT-01 after all?");
    expect(html.indexOf("QB-4469")).toBeGreaterThan(-1);
    expect(html.indexOf("QB-4469")).toBeLessThan(html.indexOf("QB-4470"));
    expect(html).toContain("If it's not, grab one from here:");
    expect(html).not.toContain("No good Lubricator anywhere");
    expect(html).toContain("LB-811");
  });

  it("Grab one from here skips iron out on a job or flagged missing", () => {
    const pieces = [
      piece("sw02", "Swivel #2", "SW-1102", "ct02", { out: true }),
      piece("sw07", "Swivel #7", "SW-1107", null, { missing: true }),
      piece("sw08", "Swivel #8", "SW-1108", null, { near: true }),
    ];
    const html = text(render({ pieces, kit: [{ label: "Swivel", qty: 1 }], initialScans: {} }));
    expect(html).toContain("SW-1108");
    expect(html).not.toContain("SW-1102");
    expect(html).not.toContain("SW-1107");
  });

  it("a red piece still logged on the truck can be said to be off without scanning it", () => {
    const pieces = [piece("pv31", "2in plug valve", "PV-2231", "ct01", { problem: "red", statusText: "UT: expired Oct 30" })];
    const html = text(render({ pieces, initialScans: {} }));
    expect(html).toContain("Took it off");
  });

  it("an NFC phone in a yard where nothing was ever read off a tag checks pieces off like an iPhone", () => {
    const noTags = text(render({ previewNfc: true, noTagsInUse: true, initialScans: {} }));
    expect(noTags).toContain("on each piece as it goes on");
    expect(noTags).toContain("Tap tags (NFC)");
    expect(noTags).toContain("If a piece has a tag or QR code");
    const tags = text(render({ previewNfc: true, initialScans: {} }));
    expect(tags).not.toContain("on each piece as it goes on");
    // A scan-only yard stays tag-first.
    expect(text(render({ previewNfc: true, noTagsInUse: true, tagRule: true, initialScans: {} }))).not.toContain("on each piece as it goes on");
  });
});
