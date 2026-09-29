import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { readPhotoText } from "../cert-read";
import { findDates } from "../cert-dates";

/**
 * The real reader on real-looking paper: a clean card, a blurry cert, one
 * in shade and tilted. A photo-prep change that "helps" one of these and
 * wrecks another (a full contrast stretch turned a clean card into noise)
 * fails here instead of in a yard.
 */

async function paper(lines: string[], opts: { rot?: number; shade?: boolean; blur?: number } = {}): Promise<Buffer> {
  let y = 140;
  const text = lines.map((l, i) => {
    const size = i === 0 ? 56 : 40;
    const out = `<text x="110" y="${y}" font-family="Arial" font-size="${size}"${i === 0 ? ' font-weight="bold"' : ""}>${l}</text>`;
    y += size * 1.9;
    return out;
  }).join("");
  const bg = opts.shade
    ? `<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#e9e3d2"/><stop offset="1" stop-color="#6d6556"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`
    : `<rect width="100%" height="100%" fill="#f3efe4"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200">${bg}<g transform="rotate(${opts.rot ?? 1} 900 600)" fill="#1b1b1b">${text}</g></svg>`;
  let img = sharp(Buffer.from(svg));
  if (opts.blur) img = img.blur(opts.blur);
  return img.jpeg({ quality: 75 }).toBuffer();
}

const expiryOn = async (buf: Buffer) => findDates((await readPhotoText(buf)) ?? "").map((d) => d.iso);

describe("reading cert photos on the server", () => {
  it("a clean, sparse card (the one the contrast stretch broke)", async () => {
    const buf = await paper(["SAFELANDUSA", "Orientation Certificate", "MARCUS VILLARREAL", "Completed: 09/28/2026", "Expires: 09/28/2028"]);
    expect(await expiryOn(buf)).toContain("2028-09-28");
  }, 30_000);

  it("a blurry pressure-test cert", async () => {
    const buf = await paper(["PERMIAN PRESSURE TESTING LLC", "CERTIFICATE OF PRESSURE TEST - BOP", "Equipment: Quad BOP stack #3", "Date tested: 09/27/2026", "Expires: 03/27/2027"], { blur: 1.5 });
    expect(await expiryOn(buf)).toContain("2027-03-27");
  }, 30_000);

  it("a card in shade, tilted", async () => {
    const buf = await paper(["H2S CLEAR", "This certifies that KEVIN ODOM", "Issued: 08/14/2026", "Expires: 08/14/2027"], { shade: true, rot: -3, blur: 1 });
    expect(await expiryOn(buf)).toContain("2027-08-14");
  }, 30_000);
});
