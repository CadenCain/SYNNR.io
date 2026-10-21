/**
 * A tag's fingerprint. The scan page matches what the phone reads off a tag
 * against these, never against the tag codes themselves, so the codes aren't
 * sitting in the page for anyone to copy. The code read off the tag goes to
 * the server with the scan as proof the piece was there (scan-proof.ts).
 * Same answer in the browser and on the server (Web Crypto in both).
 */
export async function tagKey(code: string): Promise<string> {
  const data = new TextEncoder().encode(`rollready-tag:${code.trim().toLowerCase()}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}
