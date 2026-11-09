import { DEMO_UNITS, DEMO_PACKAGES, DEMO_KIT_CHECKS, type DemoLoadout, type DemoAsset, type DemoUnit } from "./demo-data";
import { judgeItem, isNoPaper } from "./judge";
import { addDaysIso } from "./status";
import { expectedLines, fillLines, loadoutVerdict, kitLinesFrom, type BadPiece } from "./loadout-lines";
import { requiredChecks } from "./roll-checks";

/**
 * A demo truck's kit, made the way a real one is from what's on it: one line
 * per kind of piece, named for the kind ("Fluid end", "Reel, 2-3/8in"), not
 * for the one piece or the truck it's on, so any good one of that kind fills it.
 */
export const demoKitLines = (unit: DemoUnit) => kitLinesFrom(
  (unit.assets ?? []).filter((a) => a.status !== "retired").map((a) => ({ name: a.name, serial: a.identifier ?? null })),
  DEMO_UNITS.map((u) => u.name),
);
/** Trucks that carry a BOP ask for the rams closed before they roll. */
export const demoKitChecks = (unit: DemoUnit) => ((unit.assets ?? []).some((a) => /\bBOP\b/i.test(a.name)) ? DEMO_KIT_CHECKS : []);

/**
 * A demo load-out worked out by the same rules as a real one: the truck's
 * kit plus any packages, every piece on the truck scanned, and READY or NOT
 * READY from the pieces' tests. The seed and the marketing screenshot both
 * use it, so the demo can't tell a different story than the app would.
 * Pieces are keyed by serial (or name for untested baskets).
 */
export const demoKey = (a: DemoAsset) => a.identifier ?? a.name;

export function demoLoadoutRecord(lo: DemoLoadout, today: string) {
  const unit = DEMO_UNITS.find((u) => u.key === lo.unitKey)!;
  const onTruck = (unit.assets ?? []).filter((a) => a.status !== "retired");
  const judge = (it: { title: string; exp: number | null; noPaper?: boolean }) => {
    const good_until = it.exp === null ? null : addDaysIso(today, it.exp);
    const r = judgeItem({ id: "", title: it.title, expiration_date: good_until, reminder_days: 30, pending_until: null, last_upload_id: it.noPaper ? null : "demo" }, today, today);
    return { title: it.title, good_until, result: isNoPaper(r) ? "no_paper" : r.result as string, detail: r.detail };
  };
  const bad: (BadPiece & { key: string })[] = [];
  for (const a of onTruck) {
    if (a.status === "out_of_service") { bad.push({ key: demoKey(a), name: a.name, serial: a.identifier ?? null, why: "red_tagged" }); continue; }
    for (const t of (a.items ?? []).map(judge)) {
      if (t.result === "expired") bad.push({ key: demoKey(a), name: a.name, serial: a.identifier ?? null, why: "out_of_test", detail: `${t.title} ${t.detail}` });
      else if (t.result === "no_paper") bad.push({ key: demoKey(a), name: a.name, serial: a.identifier ?? null, why: "no_paper", detail: t.title });
      else if (t.result === "missing") bad.push({ key: demoKey(a), name: a.name, serial: a.identifier ?? null, why: "no_test_date", detail: t.title });
    }
  }
  const packages = DEMO_PACKAGES.filter((p) => (lo.packages ?? []).includes(p.name));
  const lines = fillLines(
    expectedLines({ kit: demoKitLines(unit), packages, quick: [] }),
    onTruck.map((a) => ({ id: demoKey(a), name: a.name, serial: a.identifier ?? null })),
  );
  const truckPaper = (unit.items ?? []).map(judge).filter((t) => t.result === "expired" || t.result === "missing").map((t) => ({ title: t.title, detail: t.detail }));
  const v = loadoutVerdict({ lines, bad, cantFind: [], truckPaper, scanned: onTruck.length });
  const badKeys = new Set(bad.map((b) => b.key));
  return {
    unit,
    onTruck,
    verdict: v.verdict,
    reasons: v.reasons,
    packages: packages.map((p) => p.name),
    /** The checks the kit and packages ask for before it rolls: the loader taps each one. */
    checks: requiredChecks(demoKitChecks(unit), ...packages.map((p) => p.checks)),
    lines,
    pieces: onTruck.map((a) => ({
      key: demoKey(a), name: a.name, serial: a.identifier ?? null, red: badKeys.has(demoKey(a)),
      tests: (a.items ?? []).map(judge).map(({ title, good_until, result }) => ({ title, good_until, result })),
    })),
  };
}
