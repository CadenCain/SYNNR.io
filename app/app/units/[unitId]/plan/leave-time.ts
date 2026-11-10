/**
 * The leave time on the yard's clock, not the phone's. A manager in Midland
 * (Central) planning a Hobbs truck (Mountain) for 5:00 means 5:00 in Hobbs:
 * read on his phone's clock it saved 4:00 Mountain. Pure, so the phone and the
 * tests run the same math.
 */

const parse = (wall: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(wall);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : NaN;
};

/** "2026-11-16T05:00": this time on the yard's clock, for the time picker. Empty if there's none. */
export function wallClock(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** How far the yard's clock is ahead of UTC at this moment (negative in the US), in ms. */
function offsetAt(ms: number, tz: string): number {
  const minute = Math.floor(ms / 60e3) * 60e3;
  return parse(wallClock(new Date(minute).toISOString(), tz)) - minute;
}

/** "2026-11-16T05:00" on the yard's clock, as a moment (ISO). Null if it isn't a time. */
export function fromWallClock(wall: string, tz: string): string | null {
  const asUtc = parse(wall);
  if (!Number.isFinite(asUtc)) return null;
  const guess = asUtc - offsetAt(asUtc, tz);
  // Near a clock change the offset at the real moment can differ from the first guess.
  const ms = asUtc - offsetAt(guess, tz);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
