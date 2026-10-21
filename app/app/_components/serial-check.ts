/**
 * Checking a piece by hand means reading the last 4 of its serial off the
 * band or the stamp. The screen hides those 4 until the piece is scanned,
 * so the check proves someone looked at the iron. Used by load-out and
 * check-in alike.
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
