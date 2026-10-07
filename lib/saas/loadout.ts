/**
 * Load-out scan logic, kept pure so it's pinned by tests: what a scanned tag
 * is, which piece it belongs to, and what the scan means for the truck.
 */

export type ScanHow = "nfc" | "qr" | "hand";

export interface ScanPiece {
  id: string;
  name: string;
  serial: string | null;
  unitId: string | null;
  where: string;
  tagToken: string;
  /** A linked outside tag: an NFC chip ID ("04:a2:...") or "qr:<content>". */
  extTag: string | null;
  /** Red: overdue, red-tagged, or missing. Yellow: due soon. */
  problem: "red" | "yellow" | null;
  statusText: string;
}

/** What one scan found. */
export type ScanResult =
  | { kind: "match"; piece: ScanPiece; onTruck: boolean }
  | { kind: "unknown"; extTag: string; fromUrl: string | null }
  | { kind: "foreign"; text: string };

const TOKEN_RE = /\/t\/([a-f0-9]{32})(?:[/?#]|$)/i;

/** The RollReady tag token in a scanned link, if it is one. */
export function tagTokenFrom(text: string): string | null {
  const m = text.trim().match(TOKEN_RE);
  return m ? m[1].toLowerCase() : null;
}

/** "04:A2:1B:..." or "04a21b..." → "04:a2:1b:..." so the same chip always matches. */
export function normalizeChipId(uid: string): string {
  const hex = uid.toLowerCase().replace(/[^0-9a-f]/g, "");
  return hex.match(/.{1,2}/g)?.join(":") ?? "";
}

/** The key an outside QR code is linked by. */
export const qrKey = (content: string) => `qr:${content.trim().slice(0, 300)}`;

/**
 * Work out what a scan is.
 *   link    the URL or text read off the tag or code (may be empty for a
 *           blank or locked NFC tag with no link)
 *   chipId  the NFC chip's factory ID, when it was an NFC tap
 */
export function identifyScan(
  input: { link: string | null; chipId: string | null; how: ScanHow },
  pieces: ScanPiece[],
  truckId: string,
): ScanResult {
  const token = input.link ? tagTokenFrom(input.link) : null;
  if (token) {
    const piece = pieces.find((p) => p.tagToken === token);
    if (piece) return { kind: "match", piece, onTruck: piece.unitId === truckId };
    return { kind: "foreign", text: "That's a RollReady tag, but not one of your company's pieces." };
  }
  // An outside tag (the testing company's NFC chip or QR code).
  const ext = input.chipId ? normalizeChipId(input.chipId) : input.link ? qrKey(input.link) : null;
  if (!ext) return { kind: "foreign", text: "Couldn't read anything off that tag. Try again, or check it by hand." };
  const piece = pieces.find((p) => p.extTag === ext);
  if (piece) return { kind: "match", piece, onTruck: piece.unitId === truckId };
  return { kind: "unknown", extTag: ext, fromUrl: input.link };
}

/** Plain-words verdict for the big banner after a scan. */
export function scanMessage(r: Extract<ScanResult, { kind: "match" }>, truckName: string, already: boolean): { tone: "good" | "warn" | "bad"; text: string } {
  const label = `${r.piece.name}${r.piece.serial ? ` ${r.piece.serial}` : ""}`;
  if (already) return { tone: "warn", text: `${label} is already scanned.` };
  if (r.piece.problem === "red") return { tone: "bad", text: `${label}: ${r.piece.statusText}. Don't load it.` };
  if (!r.onTruck) return { tone: "warn", text: `${label} was logged at ${r.piece.where}. It goes on ${truckName} when you finish.` };
  if (r.piece.problem === "yellow") return { tone: "warn", text: `${label} scanned. ${r.piece.statusText}.` };
  return { tone: "good", text: `${label} scanned.` };
}
