/**
 * Load-out scan logic, kept pure so it's pinned by tests: what a scanned tag
 * is, which piece it belongs to, and what the scan means for the truck.
 */

import { tagKey } from "./tag-key";

export type ScanHow = "nfc" | "qr" | "hand";

export interface ScanPiece {
  id: string;
  name: string;
  serial: string | null;
  unitId: string | null;
  where: string;
  /** What kind of iron (flow_iron, pressure_control, ...): pressure iron has to be scanned in a scan-only yard. */
  category: string;
  /** Fingerprint of the piece's RollReady tag (tag-key.ts). The page never holds the code itself. */
  tagKey: string;
  /** Fingerprint of a linked outside tag (an NFC chip ID or "qr:<content>"), if any. */
  extKey: string | null;
  /** Red: overdue, red-tagged, or missing. Yellow: due soon. */
  problem: "red" | "yellow" | null;
  statusText: string;
}

/** What one scan found. A match carries the code read off the tag, sent with the scan as proof. */
export type ScanResult =
  | { kind: "match"; piece: ScanPiece; onTruck: boolean; proof?: string }
  | { kind: "unknown"; extTag: string }
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

/** The codes read off a tag: RollReady's own token, or an outside chip ID or QR code. */
export function tagCodes(input: { link: string | null; chipId: string | null }): { token: string | null; ext: string | null } {
  const token = input.link ? tagTokenFrom(input.link) : null;
  if (token) return { token, ext: null };
  const ext = input.chipId ? normalizeChipId(input.chipId) : input.link ? qrKey(input.link) : null;
  return { token: null, ext: ext || null };
}

/**
 * Work out what a scan is, from the codes read off the tag and their
 * fingerprints (tag-key.ts, worked out by the caller).
 */
export function identifyScan(
  codes: { token: string | null; ext: string | null },
  keys: { token: string | null; ext: string | null },
  pieces: ScanPiece[],
  truckId: string,
): ScanResult {
  if (codes.token) {
    const piece = keys.token ? pieces.find((p) => p.tagKey === keys.token) : undefined;
    if (piece) return { kind: "match", piece, onTruck: piece.unitId === truckId, proof: codes.token };
    return { kind: "foreign", text: "That's a RollReady tag, but not one of your company's pieces." };
  }
  // An outside tag (the testing company's NFC chip or QR code).
  if (!codes.ext) return { kind: "foreign", text: "Couldn't read anything off that tag. Try again, or check it by hand." };
  const piece = keys.ext ? pieces.find((p) => p.extKey === keys.ext) : undefined;
  if (piece) return { kind: "match", piece, onTruck: piece.unitId === truckId, proof: codes.ext };
  return { kind: "unknown", extTag: codes.ext };
}

/** Read a tag on the phone: its codes, their fingerprints, and what it matches. */
export async function readScan(input: { link: string | null; chipId: string | null }, pieces: ScanPiece[], truckId: string): Promise<ScanResult> {
  const codes = tagCodes(input);
  const keys = {
    token: codes.token ? await tagKey(codes.token) : null,
    ext: codes.ext ? await tagKey(codes.ext) : null,
  };
  return identifyScan(codes, keys, pieces, truckId);
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
