/**
 * Checking a piece by hand means reading the last 4 of its serial off the
 * band or the stamp. The screen hides those 4 until the piece is scanned,
 * so the check proves someone looked at the iron. Used by load-out and
 * check-in alike, and so is finding a piece by the serial typed in.
 */

/** Letters and digits of a serial, uppercased: "QB-4471" → "QB4471". */
export const alnum = (x: string) => x.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** A serial long enough that its last 4 prove someone read the stamp. */
export const checkable = (serial: string | null) => Boolean(serial && alnum(serial).length >= 5);

/** "QB-4471" → "QB-••••": the last 4 letters or digits hidden until the piece is scanned. */
export function maskSerial(serial: string): string {
  let left = 4;
  return serial.split("").reverse().map((ch) => (/[a-z0-9]/i.test(ch) && left-- > 0 ? "•" : ch)).reverse().join("");
}

/** Do these typed characters match the serial's last 4? */
export const lastFourMatch = (typed: string, serial: string) => alnum(typed) === alnum(serial).slice(-4);

/**
 * The piece a typed serial means. Dashes, spaces and case don't count:
 * "DB2210", "db 2210" and "DB-2210" are one serial. The band often has just
 * the number, so the last 4 or more letters and digits find a piece too, but
 * only when one piece ends that way. When more than one could be it, the
 * answer is all of them (the hand types more), never a guess.
 */
export function findBySerial<P extends { serial: string | null }>(pieces: P[], typed: string): { piece: P } | { many: P[] } | null {
  const want = alnum(typed);
  if (!want) return null;
  const withSerial = pieces.filter((p) => p.serial && alnum(p.serial));
  const same = withSerial.filter((p) => alnum(p.serial!) === want);
  if (same.length === 1) return { piece: same[0] };
  if (same.length > 1) {
    // Two serials that differ only by a dash or a space: the one typed exactly, if that's one.
    const exact = same.filter((p) => p.serial!.trim().toUpperCase() === typed.trim().toUpperCase());
    return exact.length === 1 ? { piece: exact[0] } : { many: same };
  }
  if (want.length < 4) return null;
  const ends = withSerial.filter((p) => alnum(p.serial!).endsWith(want));
  if (ends.length === 1) return { piece: ends[0] };
  return ends.length ? { many: ends } : null;
}

/** What to tell the hand when a typed serial isn't one piece. */
export function serialMiss(typed: string, hit: { many: { serial: string | null }[] } | null): string {
  const t = typed.trim();
  if (!hit) return `No piece with serial ${t}. Check the stamp and try again.`;
  const shown = hit.many.slice(0, 4).map((p) => p.serial).join(", ");
  return `More than one piece matches ${t}: ${shown}${hit.many.length > 4 ? ", and more" : ""}. Type the whole serial off the stamp.`;
}
