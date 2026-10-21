import type { ScanHow } from "./loadout";

/**
 * How a piece was really checked. A phone says "NFC" or "QR" and sends the
 * code it read off the tag; the scan only counts as a tag scan if that code
 * is this piece's own RollReady tag or the outside tag linked to it. Anything
 * else (no code, someone else's code, a phone that only claimed a scan) is a
 * check by hand, and goes on the record that way.
 */
export function provenHow(how: ScanHow, proof: string | null | undefined, tag: { tag_token: string | null; nfc_uid: string | null }): ScanHow {
  if (how !== "nfc" && how !== "qr") return "hand";
  const code = String(proof ?? "").trim().toLowerCase();
  if (!code) return "hand";
  if (tag.tag_token && code === tag.tag_token.trim().toLowerCase()) return how;
  if (tag.nfc_uid && code === tag.nfc_uid.trim().toLowerCase()) return how;
  return "hand";
}
