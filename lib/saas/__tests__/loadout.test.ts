import { describe, it, expect } from "vitest";
import { tagTokenFrom, normalizeChipId, qrKey, identifyScan, scanMessage, type ScanPiece } from "../loadout";

const TOKEN = "6fadc6144e4544b795e99ce566020fda";
const piece = (over: Partial<ScanPiece> = {}): ScanPiece => ({
  id: "a1", name: "2in 1502 plug valve", serial: "PV-2203", unitId: "ct3", where: "CT-03 · Odessa Yard",
  tagToken: TOKEN, extTag: null, problem: null, statusText: "Current", ...over,
});

describe("reading what's on a tag", () => {
  it("finds the RollReady token in a tag link, any case, with or without extras", () => {
    expect(tagTokenFrom(`https://www.synnr.io/t/${TOKEN}`)).toBe(TOKEN);
    expect(tagTokenFrom(`https://synnr.io/t/${TOKEN.toUpperCase()}?x=1`)).toBe(TOKEN);
    expect(tagTokenFrom("https://irontrac.example/asset/123")).toBeNull();
  });
  it("chip IDs match no matter how the phone writes them", () => {
    expect(normalizeChipId("04:A2:1B:FF")).toBe("04:a2:1b:ff");
    expect(normalizeChipId("04a21bff")).toBe("04:a2:1b:ff");
  });
});

describe("identifyScan", () => {
  it("a RollReady tag on this truck's piece is a match, on the truck", () => {
    const r = identifyScan({ link: `https://www.synnr.io/t/${TOKEN}`, chipId: "04:aa", how: "nfc" }, [piece()], "ct3");
    expect(r).toMatchObject({ kind: "match", onTruck: true });
  });
  it("a piece logged somewhere else is a match, not on the truck", () => {
    const r = identifyScan({ link: `https://www.synnr.io/t/${TOKEN}`, chipId: null, how: "qr" }, [piece({ unitId: null })], "ct3");
    expect(r).toMatchObject({ kind: "match", onTruck: false });
  });
  it("a testing company's NFC tag is found by its linked chip ID", () => {
    const r = identifyScan({ link: "https://portal.example/a/9", chipId: "04:A2:1B", how: "nfc" }, [piece({ extTag: "04:a2:1b" })], "ct3");
    expect(r).toMatchObject({ kind: "match" });
  });
  it("an unlinked outside tag asks which piece it's on", () => {
    const r = identifyScan({ link: "https://portal.example/a/9", chipId: "04:A2:1B", how: "nfc" }, [piece()], "ct3");
    expect(r).toEqual({ kind: "unknown", extTag: "04:a2:1b", fromUrl: "https://portal.example/a/9" });
  });
  it("an outside QR code is linked by its content", () => {
    const r = identifyScan({ link: "TESTCO-998877", chipId: null, how: "qr" }, [piece({ extTag: qrKey("TESTCO-998877") })], "ct3");
    expect(r).toMatchObject({ kind: "match" });
  });
  it("another company's RollReady tag is never matched", () => {
    const r = identifyScan({ link: `https://www.synnr.io/t/${"f".repeat(32)}`, chipId: null, how: "qr" }, [piece()], "ct3");
    expect(r.kind).toBe("foreign");
  });
});

describe("scanMessage", () => {
  const m = (p: Partial<ScanPiece>, onTruck = true, already = false) =>
    scanMessage({ kind: "match", piece: piece(p), onTruck }, "CT-03", already);
  it("red iron says don't load it", () => {
    expect(m({ problem: "red", statusText: "Red-tagged" })).toEqual({ tone: "bad", text: "2in 1502 plug valve PV-2203: Red-tagged. Don't load it." });
  });
  it("iron from somewhere else says where it was logged", () => {
    expect(m({ where: "Odessa Yard" }, false).text).toBe("2in 1502 plug valve PV-2203 was logged at Odessa Yard. It goes on CT-03 when you finish.");
  });
  it("a clean scan is good", () => {
    expect(m({})).toEqual({ tone: "good", text: "2in 1502 plug valve PV-2203 scanned." });
  });
  it("a second scan of the same piece says so", () => {
    expect(m({}, true, true).tone).toBe("warn");
  });
});
