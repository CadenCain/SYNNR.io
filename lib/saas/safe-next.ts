/**
 * Where to send someone after logging in, joining, or resetting a password:
 * a path on this site, or the fallback. Never another site. Browsers read
 * "/\evil.com" and "/<tab>/evil.com" as "//evil.com", so a backslash or any
 * control character anywhere is refused, and whatever's left has to resolve
 * to this site. Safe to import on the server and in the browser.
 */
export function safeNext(n: unknown, fallback = ""): string {
  const s = String(n ?? "");
  if (!s.startsWith("/") || s.length >= 300 || /[\\\x00-\x1f\x7f]/.test(s)) return fallback;
  try {
    const u = new URL(s, "https://here.invalid");
    return u.origin === "https://here.invalid" ? s : fallback;
  } catch {
    return fallback;
  }
}
