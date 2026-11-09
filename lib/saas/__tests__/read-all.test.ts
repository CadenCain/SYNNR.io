import { describe, it, expect } from "vitest";
import { readAll } from "../read-all";

/** A fake table of n rows behind a page cap (the database API's max rows). */
function table(n: number, cap = 1000) {
  const rows = Array.from({ length: n }, (_, i) => ({ id: i }));
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, Math.min(to + 1, from + cap)), error: null, count: n };
  };
  return { page, calls };
}

describe("reading every row", () => {
  it("a small shop is one request", async () => {
    const t = table(40);
    expect((await readAll(t.page)).length).toBe(40);
    expect(t.calls.length).toBe(1);
  });
  it("a big shop gets all 2,350 rows, in order, across pages", async () => {
    const t = table(2350);
    const got = await readAll<{ id: number }>(t.page);
    expect(got.length).toBe(2350);
    expect(got[2349].id).toBe(2349);
  });
  it("still gets everything when the database's cap is smaller than a page", async () => {
    const t = table(1200, 500);
    expect((await readAll(t.page)).length).toBe(1200);
  });
  it("stops on an error with what it has", async () => {
    let n = 0;
    const got = await readAll(async () => (n++ === 0 ? { data: [{ id: 1 }], error: null, count: 5 } : { data: null, error: { message: "x" } }));
    expect(got).toEqual([{ id: 1 }]);
  });
});
