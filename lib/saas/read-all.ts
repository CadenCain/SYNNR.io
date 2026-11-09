/**
 * Read every row a list query matches, not just the first page. The database
 * API hands back at most a page of rows per request (1,000 by default), and a
 * big shop has more pieces and tests than that: the phone, the board, and
 * Tests due all have to see every one, or they disagree with the server.
 *
 * `page(from, to)` builds the query for one page. It must ask for the total
 * (`select(cols, { count: "exact" })`) and have a stable order (end with an
 * order on a unique column, like id). A shop under one page is one request.
 * On an error it returns what it has so far, like a single query would.
 */
type Page = { data: unknown[] | null; error: unknown; count?: number | null };

const PAGE = 1000;
const MAX_ROWS = 100_000;

export async function readAll<T>(page: (from: number, to: number) => PromiseLike<Page>): Promise<T[]> {
  const out: T[] = [];
  let total: number | null = null;
  while (out.length < MAX_ROWS) {
    const { data, error, count } = await page(out.length, out.length + PAGE - 1);
    if (error) break;
    const rows = (data ?? []) as T[];
    if (total === null) total = typeof count === "number" ? count : null;
    out.push(...rows);
    // Done when we have them all, or the database has nothing more to give.
    if (!rows.length || (total !== null ? out.length >= total : rows.length < PAGE)) break;
  }
  return out;
}
