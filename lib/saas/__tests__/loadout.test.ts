import { describe, it, expect } from "vitest";
import { tagTokenFrom, normalizeChipId, qrKey, readScan, scanMessage, type ScanPiece } from "../loadout";
import { tagKey } from "../tag-key";
import { provenHow } from "../scan-proof";

const TOKEN = "6fadc6144e4544b795e99ce566020fda";
const piece = (over: Partial<ScanPiece> = {}): ScanPiece => ({
  id: "a1", name: "2in 1502 plug valve", serial: "PV-2203", unitId: "ct3", where: "CT-03 · Odessa Yard", category: "flow_iron",
  tagKey: "", extKey: null, problem: null, statusText: "Current", ...over,
});
const keyed = async (over: Partial<ScanPiece> = {}, ext: string | null = null) =>
  piece({ tagKey: await tagKey(TOKEN), extKey: ext ? await tagKey(ext) : null, ...over });

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
  it("the page holds a fingerprint, never the tag code", async () => {
    const k = await tagKey(TOKEN);
    expect(k).toMatch(/^[0-9a-f]{32}$/);
    expect(k).not.toContain(TOKEN);
    expect(await tagKey(TOKEN.toUpperCase())).toBe(k);
  });
});

describe("readScan", () => {
  it("a RollReady tag on this truck's piece is a match, on the truck, with the code as proof", async () => {
    const r = await readScan({ link: `https://www.synnr.io/t/${TOKEN}`, chipId: "04:aa" }, [await keyed()], "ct3");
    expect(r).toMatchObject({ kind: "match", onTruck: true, proof: TOKEN });
  });
  it("a piece logged somewhere else is a match, not on the truck", async () => {
    const r = await readScan({ link: `https://www.synnr.io/t/${TOKEN}`, chipId: null }, [await keyed({ unitId: null })], "ct3");
    expect(r).toMatchObject({ kind: "match", onTruck: false });
  });
  it("a testing company's NFC tag is found by its linked chip ID", async () => {
    const r = await readScan({ link: "https://portal.example/a/9", chipId: "04:A2:1B" }, [await keyed({}, "04:a2:1b")], "ct3");
    expect(r).toMatchObject({ kind: "match", proof: "04:a2:1b" });
  });
  it("an unlinked outside tag asks which piece it's on", async () => {
    const r = await readScan({ link: "https://portal.example/a/9", chipId: "04:A2:1B" }, [await keyed()], "ct3");
    expect(r).toEqual({ kind: "unknown", extTag: "04:a2:1b" });
  });
  it("an outside QR code is linked by its content", async () => {
    const r = await readScan({ link: "TESTCO-998877", chipId: null }, [await keyed({}, qrKey("TESTCO-998877"))], "ct3");
    expect(r).toMatchObject({ kind: "match" });
  });
  it("another company's RollReady tag is never matched", async () => {
    const r = await readScan({ link: `https://www.synnr.io/t/${"f".repeat(32)}`, chipId: null }, [await keyed()], "ct3");
    expect(r.kind).toBe("foreign");
  });
});

describe("provenHow: a scan only counts if the code read off the tag is this piece's", () => {
  const tag = { tag_token: TOKEN, nfc_uid: "04:a2:1b" };
  it("its own QR or linked chip counts", () => {
    expect(provenHow("qr", TOKEN, tag)).toBe("qr");
    expect(provenHow("nfc", "04:A2:1B", tag)).toBe("nfc");
  });
  it("a phone that only claims a scan, or sends another piece's code, is a check by hand", () => {
    expect(provenHow("qr", undefined, tag)).toBe("hand");
    expect(provenHow("nfc", "", tag)).toBe("hand");
    expect(provenHow("qr", "f".repeat(32), tag)).toBe("hand");
    expect(provenHow("hand", TOKEN, tag)).toBe("hand");
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
