import { describe, it, expect } from "vitest";
import { safeNext } from "../safe-next";

describe("where to go after logging in", () => {
  it("keeps a path on this site", () => {
    for (const ok of ["/app", "/invite/abc_123-x", "/app/units/1/scan?x=1#y", "/reset?next=%2Finvite%2Fabc"]) expect(safeNext(ok)).toBe(ok);
  });
  it("never another site, however it's dressed up", () => {
    for (const bad of ["//evil.test", "/\\evil.test", "/\\\\evil.test", "/\t/evil.test", "/\n/evil.test", "/%09/evil.test".replace("%09", "\t"),
      "https://evil.test", "javascript:alert(1)", "evil.test", "", null, undefined, "/" + "a".repeat(400)]) {
      expect(safeNext(bad, "/app")).toBe("/app");
    }
  });
});
