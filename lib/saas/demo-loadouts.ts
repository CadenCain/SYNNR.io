import { DEMO_UNITS, DEMO_PACKAGES, type DemoLoadout, type DemoAsset } from "./demo-data";
import { judgeItem } from "./judge";
import { addDaysIso } from "./status";
import { expectedLines, fillLines, loadoutVerdict, kitLinesFrom, type BadPiece } from "./loadout-lines";

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
  const judge = (it: { title: string; exp: number | null }) => {
    const good_until = it.exp === null ? null : addDaysIso(today, it.exp);
    const r = judgeItem({ id: "", title: it.title, expiration_date: good_until, reminder_days: 30, pending_until: null }, today, today);
    return { title: it.title, good_until, result: r.result as string, detail: r.detail };
  };
  const bad: (BadPiece & { key: string })[] = [];
  for (const a of onTruck) {
    if (a.status === "out_of_service") { bad.push({ key: demoKey(a), name: a.name, serial: a.identifier ?? null, why: "red_tagged" }); continue; }
    for (const t of (a.items ?? []).map(judge)) {
      if (t.result === "expired") bad.push({ key: demoKey(a), name: a.name, serial: a.identifier ?? null, why: "out_of_test", detail: `${t.title} ${t.detail}` });
      else if (t.result === "missing") bad.push({ key: demoKey(a), name: a.name, serial: a.identifier ?? null, why: "no_test_date", detail: t.title });
    }
  }
  const packages = DEMO_PACKAGES.filter((p) => (lo.packages ?? []).includes(p.name));
  const lines = fillLines(
    expectedLines({ kit: kitLinesFrom(onTruck.map((a) => a.name)), packages, quick: [] }),
    onTruck.map((a) => ({ id: demoKey(a), name: a.name, serial: a.identifier ?? null })),
  );
  const truckPaper = (unit.items ?? []).map(judge).filter((t) => t.result === "expired" || t.result === "missing").map((t) => ({ title: t.title, detail: t.detail }));
  const v = loadoutVerdict({ lines, bad, cantFind: [], truckPaper });
  const badKeys = new Set(bad.map((b) => b.key));
  return {
    unit,
    onTruck,
    verdict: v.verdict,
    reasons: v.reasons,
    packages: packages.map((p) => p.name),
    lines,
    pieces: onTruck.map((a) => ({
      key: demoKey(a), name: a.name, serial: a.identifier ?? null, red: badKeys.has(demoKey(a)),
      tests: (a.items ?? []).map(judge).map(({ title, good_until, result }) => ({ title, good_until, result })),
    })),
  };
}
