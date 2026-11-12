import { describe, it, expect } from "vitest";
import { isPhoto, MIN_PHOTO_BYTES, photoPath } from "../job-photos";
import { fromThisSite } from "../same-site";

const filled = (head: number[], size = 4096) => { const b = new Uint8Array(size); b.set(head); return b; };
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

describe("a proof photo has to really be a photo", () => {
  it("knows a JPEG, a PNG and a WebP by their first bytes", () => {
    expect(isPhoto(filled(JPEG), "image/jpeg")).toBe(true);
    expect(isPhoto(filled(PNG), "image/png")).toBe(true);
    expect(isPhoto(filled(WEBP), "image/webp")).toBe(true);
  });

  it("refuses a file that only says it's a photo", () => {
    // One byte labelled image/jpeg used to put a critical piece on the truck.
    expect(isPhoto(new Uint8Array([0xff]), "image/jpeg")).toBe(false);
    expect(isPhoto(filled([0x25, 0x50, 0x44, 0x46]), "image/jpeg")).toBe(false); // a PDF
    expect(isPhoto(filled(PNG), "image/jpeg")).toBe(false); // the label and the bytes disagree
    expect(isPhoto(filled(JPEG), "image/heic")).toBe(false); // a kind SYNNR doesn't keep
  });

  it("refuses anything too small to be a picture of something", () => {
    expect(isPhoto(filled(JPEG, MIN_PHOTO_BYTES - 1), "image/jpeg")).toBe(false);
    expect(isPhoto(filled(JPEG, MIN_PHOTO_BYTES), "image/jpeg")).toBe(true);
  });

  it("gives every photo its own file, so a retake never writes over the one before it", () => {
    const a = photoPath("co", "job", "line", "image/jpeg", 1794500000000);
    const b = photoPath("co", "job", "line", "image/jpeg", 1794500000001);
    expect(a).not.toBe(b);
    // Still inside the company's folder for that job, which is what the database checks.
    expect(a.startsWith("co/jobs/job/line-")).toBe(true);
    expect(a.endsWith(".jpg")).toBe(true);
    expect(photoPath("co", "job", "line", "image/png", 1).endsWith(".png")).toBe(true);
  });
});

describe("a form post has to come from this site's own pages", () => {
  const req = (headers: Record<string, string>) => new Request("https://www.synnr.io/demo/start", { method: "POST", headers });

  it("takes one from the same site", () => {
    expect(fromThisSite(req({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(fromThisSite(req({ origin: "https://www.synnr.io", host: "www.synnr.io" }))).toBe(true);
  });

  it("refuses one from another site", () => {
    expect(fromThisSite(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(fromThisSite(req({ "sec-fetch-site": "same-site" }))).toBe(false);
    expect(fromThisSite(req({ origin: "https://evil.example", host: "www.synnr.io" }))).toBe(false);
    expect(fromThisSite(req({ origin: "not a url", host: "www.synnr.io" }))).toBe(false);
  });

  it("lets through a request that doesn't say where it came from (the token or the cap guards those)", () => {
    expect(fromThisSite(req({}))).toBe(true);
  });
});
