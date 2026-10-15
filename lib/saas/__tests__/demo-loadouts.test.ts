import { describe, it, expect } from "vitest";
import { DEMO_LOADOUTS } from "../demo-data";
import { demoLoadoutRecord } from "../demo-loadouts";

const TODAY = "2026-10-14";
const rec = (key: string) => demoLoadoutRecord(DEMO_LOADOUTS.find((l) => l.unitKey === key)!, TODAY);

describe("the demo yard's load-outs, by the real rules", () => {
  it("CT-02 loads out READY: its kit is all there and in test", () => {
    expect(rec("ct2").verdict).toBe("ready");
    expect(rec("ct2").reasons).toEqual([]);
  });
  it("CT-03 is blocked by the BOP stack that's out of test, and only that", () => {
    const r = rec("ct3");
    expect(r.verdict).toBe("not_ready");
    expect(r.reasons).toEqual(["Out of test: Quad BOP stack #3 QB-4471, BOP pressure test expired Oct 8, 2026 (6d ago)"]);
    expect(r.pieces.filter((p) => p.red).map((p) => p.serial)).toEqual(["QB-4471"]);
  });
  it("CT-07 came back short on the pump-down package (the one a manager rolled anyway)", () => {
    const r = rec("ct7");
    expect(r.verdict).toBe("not_ready");
    expect(r.reasons).toEqual([
      "Short: 2in 1502 plug valve, 0 of 1 scanned (Pump-down package)",
      "Short: 2in 1502 Chiksan swivel, 0 of 1 scanned (Pump-down package)",
    ]);
    expect(DEMO_LOADOUTS.find((l) => l.unitKey === "ct7")!.override?.reason.length).toBeGreaterThanOrEqual(10);
  });
  it("P-01 loads out READY", () => {
    expect(rec("p1").verdict).toBe("ready");
  });
});
