/**
 * Test-only in-memory Supabase stand-in — just enough of the PostgREST
 * builder chain for sweepAlerts / computeDispatchCheck / server actions to
 * run REAL production code against fixture rows. Filters actually filter
 * (eq / in / not-is-null); shaping calls (select / or / order / limit) pass
 * through — fixtures are crafted so or() clauses would match anyway.
 * Writes are captured, never applied: tests assert on what was ATTEMPTED.
 */

type Row = Record<string, unknown>;
export interface CapturedWrite { table: string; kind: "insert" | "update" | "delete"; payload?: unknown; filters: Record<string, unknown> }

class QueryBuilder {
  private rows: Row[];
  private singleMode = false;
  private write: CapturedWrite | null = null;

  constructor(
    private table: string,
    data: Row[],
    private log: CapturedWrite[],
  ) {
    this.rows = [...data];
  }

  select() { return this; }
  or() { return this; }
  order() { return this; }
  limit() { return this; }

  eq(col: string, val: unknown) {
    if (this.write) this.write.filters[col] = val;
    else this.rows = this.rows.filter((r) => r[col] === val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    if (this.write) this.write.filters[col] = vals;
    else this.rows = this.rows.filter((r) => (vals as unknown[]).includes(r[col]));
    return this;
  }
  not(col: string, op: string, val: unknown) {
    if (op === "is" && val === null) this.rows = this.rows.filter((r) => r[col] !== null && r[col] !== undefined);
    return this;
  }
  gte(col: string, val: unknown) {
    this.rows = this.rows.filter((r) => String(r[col] ?? "") >= String(val));
    return this;
  }
  maybeSingle() { this.singleMode = true; return this; }
  single() { this.singleMode = true; return this; }

  insert(payload: unknown) {
    this.write = { table: this.table, kind: "insert", payload, filters: {} };
    this.log.push(this.write);
    return this;
  }
  update(payload: unknown) {
    this.write = { table: this.table, kind: "update", payload, filters: {} };
    this.log.push(this.write);
    return this;
  }
  delete() {
    this.write = { table: this.table, kind: "delete", filters: {} };
    this.log.push(this.write);
    return this;
  }

  then<T>(resolve: (v: { data: unknown; error: null }) => T): T {
    if (this.write) {
      // writes resolve like PostgREST: inserted row(s) echo back; .single()
      // after insert gets a fabricated id so create-then-attach flows proceed
      const data = this.singleMode ? { id: "fake-new-id", ...(Array.isArray(this.write.payload) ? {} : (this.write.payload as Row)) } : this.write.payload;
      return resolve({ data, error: null });
    }
    return resolve({ data: this.singleMode ? (this.rows[0] ?? null) : this.rows, error: null });
  }
}

export function fakeSupabase(tables: Record<string, Row[]>) {
  const writes: CapturedWrite[] = [];
  const client = {
    from(table: string) { return new QueryBuilder(table, tables[table] ?? [], writes); },
    storage: { from() { return { upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: { signedUrl: "https://signed" } }) }; } },
    auth: { admin: { getUserById: async () => ({ data: { user: null } }) } },
  };
  return { client, writes };
}
