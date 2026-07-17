/** Display formatting for date-only strings (YYYY-MM-DD).
 *  Parsed as LOCAL midnight — `new Date("2026-08-14")` alone is UTC midnight,
 *  which renders as the previous day anywhere west of Greenwich. */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(`${d}T00:00:00`);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
