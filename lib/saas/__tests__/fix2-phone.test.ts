import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * The load-out phone, round two:
 *   - A piece on another truck's open trip, or a tool signed out on a long
 *     run and only checked on by hand, reads red on its line and on "Before
 *     you save" (the server blocks on it). Its tag scan counts.
 *   - "Fix it and scan again" doesn't tell the hand to take good iron off the
 *     truck when the server held it for where the records have it.
 *   - A truck that rolled minutes ago reads as a re-scan, not "out on a job".
 *   - A plan for a later job shows, without locking anything. A plan's leave
 *     time shows on its card.
 *   - The packages the server checked catch up after NOT READY.
 *   - "No signal" only when the phone has none.
 *   - A draft someone else's load-out landed after isn't offered to save.
 *   - A load-out started 20 hours ago shows as never sent.
 *   - Times read on the yard's clock.
 */

vi.mock("@/app/app/units/[unitId]/scan/actions", () => ({
  finishLoadout: vi.fn(async () => ({ ok: false })),
  linkTag: vi.fn(async () => ({ ok: true })),
}));

import { heldWhy, blockedWhy, heldFixText, truckOutCard, packagesCatchUp, saveErrText, draftOverrun, type PhonePiece } from "@/app/app/units/[unitId]/scan/scan-phone";
import { readNeverSent } from "@/app/app/_components/never-sent-drafts";
import LoadoutScanner from "@/app/app/units/[unitId]/scan/scanner";

const piece = (id: string, name: string, serial: string | null, unitId: string | null, extra: Partial<PhonePiece> = {}): PhonePiece => ({
  id, name, serial, unitId, where: unitId ?? "Odessa Yard", spot: null, category: "pressure_control",
  tagKey: "", extKey: null, problem: null, statusText: "Test good to Mar 3, 2027", ...extra,
});
const valve = piece("pv50", "2in plug valve", "PV-2250", "ct05", { out: true, trip: { truck: "CT-05", sinceText: "Nov 9, 5:02 AM", by: "Manuel Ortega" } });
const fox = piece("sf1", "Silver Fox setting tool", "SF-301", null, { out: true, where: "With Dale Wooten", outWith: { name: "Dale Wooten", sinceText: "Nov 3, 6:10 AM", long: true } });
const shortFox = piece("sf2", "Silver Fox setting tool", "SF-302", null, { out: true, where: "With Ray Hinojosa", outWith: { name: "Ray Hinojosa", sinceText: "Nov 9, 5:00 AM", long: false } });

describe("iron the server will hold off the truck", () => {
  it("on another truck's open trip: held, unless it's logged on this truck", () => {
    expect(heldWhy(valve, { }, "ct06")).toBe("On CT-05's job from Nov 9, 5:02 AM, and CT-05 hasn't been checked in. Check CT-05 in or use Move it on the piece.");
    expect(heldWhy(valve, undefined, "ct06")).toBeNull();
    expect(heldWhy(valve, {}, "ct05")).toBeNull();
  });

  it("signed out on a long run: held when checked on by hand, not when scanned off its tag", () => {
    expect(heldWhy(fox, {}, "ct06")).toBe("Signed out to Dale Wooten since Nov 3, 6:10 AM. Scan its tag, or check it in or use Move it on the piece.");
    expect(heldWhy(fox, { proof: "qr:SF-301" }, "ct06")).toBeNull();
    // A short sign-out goes on with the truck when it rolls READY.
    expect(heldWhy(shortFox, {}, "ct06")).toBeNull();
  });

  it("held at the last save (the phone didn't know): still held until the next save says otherwise", () => {
    expect(heldWhy(piece("x", "Swivel", "SW-1", "ct05", { held: "out_on_job" }), {}, "ct06")).toMatch(/^Out on another truck's job by the records/);
    expect(heldWhy(piece("y", "Swivel", "SW-2", null, { held: "signed_out" }), { proof: "abc" }, "ct06")).toBeNull();
  });
});

describe("why the server blocked a piece", () => {
  const reasons = [
    "Out on another truck's job: 2in plug valve PV-2250, went out on CT-05 Nov 9, 5:02 AM, loaded by Manuel Ortega, and CT-05 hasn't been checked in. If it's here, check CT-05 in or use Move it on the piece, then scan it again",
    "Signed out: Silver Fox setting tool SF-301, with Dale Wooten since Nov 3, 6:10 AM. If it's here, check it in or use Move it on the piece, then scan it again",
    "Scanned onto another truck after you: Swivel SW-1106, onto CT-06 Nov 9, 6:03 AM by Lupe Cardenas. If it's really on CT-01, scan it again",
    "Out of test: Lubricator LB-811, UT expired Oct 30",
  ];
  it("by the answer's notMovedWhy", () => {
    expect(blockedWhy(valve, { pv50: "out_on_job" }, [])).toBe("out_on_job");
  });
  it("by the reason, for a resend's answer that doesn't carry it", () => {
    expect(blockedWhy(valve, undefined, reasons)).toBe("out_on_job");
    expect(blockedWhy(fox, undefined, reasons)).toBe("signed_out");
    expect(blockedWhy(piece("sw", "Swivel", "SW-1106", "ct06"), undefined, reasons)).toBe("scanned_since");
    expect(blockedWhy(piece("lb", "Lubricator", "LB-811", "ct01"), undefined, reasons)).toBeNull();
  });
  it("Fix it says what clears it, and never to take it off the truck", () => {
    const texts = [heldFixText(valve, "out_on_job", "CT-06"), heldFixText(fox, "signed_out", "CT-06"), heldFixText(piece("sw", "Swivel", "SW-1106", "ct06"), "scanned_since", "CT-06")];
    expect(texts).toEqual([
      "2in plug valve PV-2250 is still on CT-05's trip: check CT-05 in or use Move it on the piece, then scan it again here.",
      "Silver Fox setting tool SF-301 is still signed out to Dale Wooten: scan its tag, or check it in or use Move it on the piece, then scan it again here.",
      "Swivel SW-1106 was scanned onto another truck after you: scan it again if it's really on CT-06.",
    ]);
    for (const t of texts) expect(t).not.toMatch(/take it off|Took it off|Don't load/);
    expect(heldFixText(piece("q", "Swivel", "SW-9", "ct05"), "out_on_job", "CT-06")).toBe("Swivel SW-9 is still out on another truck's job: check that truck in or use Move it on the piece, then scan it again here.");
  });
});

describe("the card for a truck that's out by the records", () => {
  it("rolled minutes ago: a re-scan, with one tap to load it out again", () => {
    expect(truckOutCard("CT-08", { since: "x", sinceText: "Nov 9, 5:10 AM", timeText: "5:10 AM", by: "Ray Hinojosa", ready: true, recent: true })).toEqual({
      title: "CT-08 was just loaded out", text: "CT-08 loaded out READY at 5:10 AM by Ray Hinojosa. Is it still in the yard? Scanning it again starts a new load-out and ends that trip. Sending a piece out to it? Use Move it on that piece.", button: "Yes, it's here: load it out again", recent: true,
    });
    expect(truckOutCard("CT-08", { since: "x", sinceText: "Nov 9, 5:10 AM", timeText: "5:10 AM", by: "Ray Hinojosa", ready: false, recent: true }).text)
      .toBe("CT-08 rolled on a manager's OK at 5:10 AM. Is it still in the yard? Scanning it again starts a new load-out and ends that trip. Sending a piece out to it? Use Move it on that piece.");
  });
  it("older: out on a job, back in the yard first", () => {
    expect(truckOutCard("CT-08", { since: "x", sinceText: "Nov 8, 5:10 AM", by: null })).toEqual({
      title: "CT-08 is out on a job", text: "CT-08 is out on a job since Nov 8, 5:10 AM. Only load it out once it's back in the yard.", button: "It's back in the yard", recent: false,
    });
  });
});

describe("the packages the server checked, after NOT READY", () => {
  const known = [{ id: "coil", name: "Standard Coil Package", lines: [{ label: "Lubricator", qty: 1 }], checks: ["Stripper rubber checked"] }];
  it("a changed line or check, and a package made after the screen opened, come in", () => {
    const c = packagesCatchUp(known, [
      { id: "coil", name: "Standard Coil Package", lines: [{ label: "Lubricator", qty: 2 }], checks: ["Stripper rubber checked", "BOP rams closed for travel"] },
      { id: "pd", name: "Pump-down", lines: [{ label: "Swivel", qty: 1 }], checks: [] },
    ]);
    expect(c.changed).toBe(true);
    expect(c.packages).toEqual([
      { id: "coil", name: "Standard Coil Package", lines: [{ label: "Lubricator", qty: 2 }], checks: ["Stripper rubber checked", "BOP rams closed for travel"] },
      { id: "pd", name: "Pump-down", lines: [{ label: "Swivel", qty: 1 }], checks: [] },
    ]);
  });
  it("the same lists: nothing changed", () => {
    expect(packagesCatchUp(known, [{ id: "coil", name: "Standard Coil Package", lines: [{ label: "lubricator", qty: 1 }], checks: ["Stripper rubber checked"] }]).changed).toBe(false);
    expect(packagesCatchUp(known, undefined)).toEqual({ packages: known, changed: false });
  });
});

describe("a save that didn't get through", () => {
  it("with signal, the first failure isn't called no signal", () => {
    expect(saveErrText({ withSignal: true, fails: 1, slow: false, online: true })).toBe("Couldn't reach RollReady. Your scans are saved on this phone. Leave this screen open and it keeps trying.");
    expect(saveErrText({ withSignal: true, fails: 2, slow: false, online: true })).toMatch(/Reload the page and tap Pick it back up\.$/);
    expect(saveErrText({ withSignal: false, fails: 0, slow: true, online: true })).toMatch(/^Weak signal, still sending\./);
    expect(saveErrText({ withSignal: false, fails: 0, slow: false, online: false })).toMatch(/^No signal\./);
  });
});

describe("a draft someone loaded the truck out over", () => {
  const draft = { startedAt: "2026-11-09T11:00:00.000Z" };
  const last = (over: Partial<Parameters<typeof draftOverrun>[1] & object> = {}) => ({ finishedAt: "2026-11-09T11:40:00.000Z", startedAt: "2026-11-09T11:20:00.000Z", by: "Lupe Cardenas", ready: true, mine: false, ...over });
  it("a READY load-out, or anyone else's, after it started: can't be saved", () => {
    expect(draftOverrun(draft, last())).toMatchObject({ by: "Lupe Cardenas" });
    expect(draftOverrun(draft, last({ ready: false }))).toBeTruthy();
    expect(draftOverrun(draft, last({ mine: true }))).toBeTruthy();
  });
  it("the hand's own NOT READY, one from before it started, the draft's own record, or a Fix it draft: left to the server", () => {
    expect(draftOverrun(draft, last({ mine: true, ready: false }))).toBeNull();
    expect(draftOverrun(draft, last({ finishedAt: "2026-11-09T10:40:00.000Z" }))).toBeNull();
    expect(draftOverrun(draft, last({ startedAt: draft.startedAt, mine: true }))).toBeNull();
    expect(draftOverrun({ ...draft, keptSince: "2026-11-09T10:00:00.000Z" }, last())).toBeNull();
    expect(draftOverrun(draft, null)).toBeNull();
  });
});

describe("never sent: a load-out started 20 hours ago", () => {
  const H = 3600e3;
  const now = Date.parse("2026-11-12T12:00:00Z");
  const trucks = [{ id: "ct02", name: "CT-02" }];
  const scans = { a: { how: "hand", at: 1 } };
  const storage = (items: Record<string, unknown>) => {
    const keys = Object.keys(items);
    return { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => (k in items ? JSON.stringify(items[k]) : null) };
  };
  it("shows even when it was picked up an hour ago", () => {
    const list = readNeverSent(storage({ "rr-loadout-ct02": { scans, savedAt: now - 1 * H, startedAt: new Date(now - 21 * H).toISOString() } }), trucks, now);
    expect(list.map((x) => x.label)).toEqual(["A load-out of CT-02"]);
  });
  it("one started 19 hours ago is still sendable, and a check-in goes by its last save", () => {
    expect(readNeverSent(storage({ "rr-loadout-ct02": { scans, savedAt: now - 1 * H, startedAt: new Date(now - 19 * H).toISOString() } }), trucks, now)).toEqual([]);
    expect(readNeverSent(storage({ "rr-return-ct02": { scans, savedAt: now - 1 * H, startedAt: new Date(now - 30 * H).toISOString() } }), trucks, now)).toEqual([]);
  });
});

describe("the load-out screen", () => {
  const truck = { id: "ct06", name: "CT-06" };
  const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(LoadoutScanner, {
    truck, pieces: [], kit: [], packages: [], ...props,
  } as Parameters<typeof LoadoutScanner>[0]));
  const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ");

  it("a truck that rolled minutes ago offers to load it out again, not 'out on a job'", () => {
    const html = text(render({ truckOut: { since: "2026-11-09T11:10:00Z", sinceText: "Nov 9, 5:10 AM", timeText: "5:10 AM", by: "Ray Hinojosa", ready: true, recent: true } }));
    expect(html).toContain("CT-06 was just loaded out");
    expect(html).toContain("CT-06 loaded out READY at 5:10 AM by Ray Hinojosa. Is it still in the yard? Scanning it again starts a new load-out and ends that trip.");
    expect(html).toContain("Yes, it's here: load it out again");
    expect(html).not.toContain("out on a job");
    expect(html).not.toContain("use Move it on that piece");
    expect(html).not.toMatch(/Start (scanning|loading)/);
  });

  it("a plan for a later job shows, and nothing is locked for it", () => {
    const packages = [{ id: "coil", name: "Standard Coil Package", lines: [{ label: "Lubricator", qty: 1 }] }];
    const html = text(render({ packages, laterPlan: { by: "Kevin", leaves: "Nov 13, 5:00 AM" } }));
    expect(html).toContain("Planned for Nov 13, 5:00 AM by Kevin. Not part of this load-out.");
    expect(html).not.toContain("planned");
    expect(html).toContain("Pick the package for this job");
  });

  it("a plan for now says when the job leaves", () => {
    const html = text(render({ plan: { id: "p1", by: "Kevin", at: "Nov 12, 4:00 AM", note: null, leaves: "Nov 12, 9:00 AM", packageIds: [], lines: [] } }));
    expect(html).toContain("Planned by Kevin, Nov 12, 4:00 AM. Leaves Nov 12, 9:00 AM");
  });

  it("a valve on CT-05's open trip, checked on: its line reads red and it's counted as not checked in", () => {
    const html = text(render({ pieces: [valve], kit: [{ label: "2in plug valve", qty: 1 }], initialScans: { pv50: { how: "hand", at: Date.parse("2026-11-09T12:00:00Z") } } }));
    expect(html).toContain("0 of 1 done");
    expect(html).toContain("1 not checked in yet");
    expect(html).toContain("On CT-05's job from Nov 9, 5:02 AM, and CT-05 hasn't been checked in.");
    expect(html).not.toContain("Took it off");
  });

  it("a tool Dale has had for days: red when tapped on by hand, fine when scanned off its tag", () => {
    const kit = [{ label: "Silver Fox setting tool", qty: 1 }];
    const byHand = text(render({ pieces: [fox], kit, initialScans: { sf1: { how: "hand", at: Date.parse("2026-11-09T12:00:00Z") } } }));
    expect(byHand).toContain("0 of 1 done");
    expect(byHand).toContain("Signed out to Dale Wooten since Nov 3, 6:10 AM.");
    const byTag = text(render({ pieces: [fox], kit, initialScans: { sf1: { how: "qr", at: Date.parse("2026-11-09T12:00:00Z"), proof: "qr:SF-301" } } }));
    expect(byTag).toContain("1 of 1 done");
    expect(byTag).not.toContain("not checked in yet");
  });

  it("a signed-out tool isn't offered to grab, and never reads 'In With'", () => {
    const html = text(render({ pieces: [shortFox, piece("sf3", "Silver Fox setting tool", "SF-303", null, { near: true })], kit: [{ label: "Silver Fox setting tool", qty: 1 }], initialScans: {} }));
    expect(html).toContain("SF-303");
    expect(html).not.toContain("SF-302");
    expect(html).not.toContain("In With");
  });

  it("times read on the yard's clock, with the zone when it isn't Central", () => {
    const at = Date.parse("2026-11-09T12:10:00Z");
    const sw = piece("sw", "Swivel", "SW-1", "ct06");
    expect(text(render({ pieces: [sw], initialScans: { sw: { how: "hand", at } }, tz: "America/Denver" }))).toContain("5:10 AM MT");
    const central = text(render({ pieces: [sw], initialScans: { sw: { how: "hand", at } } }));
    expect(central).toContain("6:10 AM");
    expect(central).not.toContain("6:10 AM CT");
  });
});
