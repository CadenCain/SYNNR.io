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
  /** Where in the yard, if noted ("rack 2"). */
  spot?: string | null;
  /** What kind of iron (flow_iron, pressure_control, ...): pressure iron has to be scanned in a scan-only yard. */
  category: string;
  /** Fingerprint of the piece's RollReady tag (tag-key.ts). The page never holds the code itself. */
  tagKey: string;
  /** Fingerprint of a linked outside tag (an NFC chip ID or "qr:<content>"), if any. */
  extKey: string | null;
  /** Red: overdue, red-tagged, or missing. Yellow: due soon. */
  problem: "red" | "yellow" | null;
  statusText: string;
  /** Out on a job that hasn't been checked in, or signed out to someone. */
  out?: boolean;
  /** Flagged missing. */
  missing?: boolean;
  /**
   * On another truck's job that hasn't been checked in: it went out on that
   * truck's newest load-out, and nobody has checked the truck in since. A
   * load-out of any other truck blocks on it until that truck is checked in
   * (or someone uses Move it on the piece). The server's rule, read when the
   * page loaded.
   */
  trip?: { truck: string; sinceText: string; by: string | null } | null;
  /**
   * Signed out to someone. long: for more than a shift, so it went on a job
   * with them, and one checked on by hand (not scanned off its tag) blocks the
   * load-out until it's checked in or moved.
   */
  outWith?: { name: string; sinceText: string; long: boolean } | null;
}

/** Out longer than a shift: it went on a job. */
export const RUN_MS = 12 * 3600e3;

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

/**
 * Plain-words verdict for the big banner after a scan. Pass the scan's proof
 * (the code read off the tag) when there is one: a tool signed out for more
 * than a shift only goes on by its tag.
 */
export function scanMessage(r: Extract<ScanResult, { kind: "match" }>, truckName: string, already: boolean): { tone: "good" | "warn" | "bad"; text: string } {
  const label = `${r.piece.name}${r.piece.serial ? ` ${r.piece.serial}` : ""}`;
  if (already) return { tone: "warn", text: `${label} is already scanned.` };
  if (r.piece.problem === "red") return { tone: "bad", text: `${label}: ${r.piece.statusText}. Don't load it.` };
  const trip = r.onTruck ? null : r.piece.trip;
  if (trip) {
    return { tone: "bad", text: `${label} is on ${trip.truck}'s job from ${trip.sinceText}, and ${trip.truck} hasn't been checked in. Check ${trip.truck} in first, or use Move it on the piece. Until then it blocks ${truckName}.` };
  }
  const w = r.onTruck ? null : r.piece.outWith;
  if (w?.long && !r.proof) {
    return { tone: "bad", text: `${label} is signed out to ${w.name} since ${w.sinceText}. If it's here, check it in or use Move it on the piece first. Until then it blocks ${truckName}.` };
  }
  if (w) return { tone: "warn", text: `${label} is signed out to ${w.name}. It goes on ${truckName}, and off ${w.name}'s sign-out, once ${truckName} rolls READY.` };
  if (!r.onTruck) return { tone: "warn", text: `${label} was logged at ${r.piece.where}. It goes on ${truckName} when you finish.` };
  if (r.piece.problem === "yellow") return { tone: "warn", text: `${label} scanned. ${r.piece.statusText}.` };
  return { tone: "good", text: `${label} scanned.` };
}
