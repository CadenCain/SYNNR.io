/**
 * A job in SYNNR: what was read off the dispatch, the list of what it takes,
 * and whether the truck is ready. Pure rules, shared by the phone and the
 * server, so both always agree.
 */

export type LineSource = "list" | "dispatch" | "added";

export type JobLine = {
  id: string;
  label: string;
  qty: number;
  critical: boolean;
  why: string | null;
  source: LineSource;
  sort: number;
  on_by: string | null;
  on_at: string | null;
  /** Where the proof photo is kept. A critical piece can't go on without one. */
  photo_path: string | null;
};

/** The job facts SYNNR keeps from a dispatch. Never people or phone numbers. */
export type JobDetails = {
  client?: string | null;
  well?: string | null;
  start?: string | null;
  tubing?: string | null;
  casing?: string | null;
  wellhead?: string | null;
  pressure_control?: string | null;
  assets?: string[];
};

export type Job = {
  id: string;
  job_type: string;
  truck: string | null;
  details: JobDetails;
  remarks: string | null;
  source: "photo" | "typed";
  status: "loading" | "ready";
  ready_by: string | null;
  ready_at: string | null;
  created_by_name: string | null;
  created_at: string;
};

/** A line as it goes onto a new job: nothing on the truck yet. */
export type NewLine = Omit<JobLine, "id" | "on_by" | "on_at" | "photo_path">;

/** Something the dispatch itself says to bring, with its reason in the dispatch's words. */
export type Callout = { item: string; qty: number; why: string };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** The order a hand loads by: what stops the job first, then the list's own order. */
export function orderLines<T extends { critical: boolean; sort: number }>(lines: T[]): T[] {
  return [...lines].sort((a, b) => Number(b.critical) - Number(a.critical) || a.sort - b.sort);
}

/** READY only when there's a list and every piece on it is on the truck. */
export function jobState(lines: Pick<JobLine, "label" | "qty" | "critical" | "on_at">[]) {
  const missing = lines.filter((l) => !l.on_at);
  return {
    total: lines.length,
    on: lines.length - missing.length,
    missing,
    criticalMissing: missing.filter((l) => l.critical).length,
    ready: lines.length > 0 && missing.length === 0,
  };
}

/**
 * The list for a new job: the shop's own list for that kind of job, then
 * whatever the dispatch itself called out. A callout the shop's list already
 * has isn't added twice; it marks that line critical and carries the reason.
 */
export function buildLines(input: { list: { label: string; qty: number; critical: boolean }[]; callouts: Callout[] }): NewLine[] {
  const out: NewLine[] = [];
  const at = new Map<string, number>();
  for (const l of input.list) {
    const label = l.label.trim().slice(0, 120);
    if (!label || at.has(norm(label))) continue;
    at.set(norm(label), out.length);
    out.push({ label, qty: clampQty(l.qty), critical: Boolean(l.critical), why: null, source: "list", sort: out.length });
  }
  for (const c of input.callouts) {
    const label = c.item.trim().slice(0, 120);
    if (!label) continue;
    const why = c.why.trim().slice(0, 300) || null;
    const i = at.get(norm(label));
    if (i !== undefined) {
      out[i] = { ...out[i], critical: true, why: out[i].why ?? why, qty: Math.max(out[i].qty, clampQty(c.qty)) };
      continue;
    }
    at.set(norm(label), out.length);
    out.push({ label, qty: clampQty(c.qty), critical: true, why, source: "dispatch", sort: out.length });
  }
  return out;
}

export const clampQty = (n: unknown) => Math.max(1, Math.min(999, Math.round(Number(n)) || 1));

/** The shop's list for this kind of job, if it has one: the same name, or one inside the other. */
export function matchList<T extends { name: string }>(lists: T[], jobType: string): T | null {
  const want = norm(jobType);
  if (!want) return null;
  return lists.find((l) => norm(l.name) === want)
    ?? lists.find((l) => norm(l.name).length >= 4 && (want.includes(norm(l.name)) || norm(l.name).includes(want)))
    ?? null;
}

/** The job facts worth showing, in the order a hand reads a dispatch. */
export function detailRows(job: Pick<Job, "details" | "truck">): [string, string][] {
  const d = job.details ?? {};
  const rows: [string, string | null | undefined][] = [
    ["Truck", job.truck],
    ["Start", d.start],
    ["Client", d.client],
    ["Well", d.well],
    ["Tubing", d.tubing],
    ["Casing", d.casing],
    ["Wellhead", d.wellhead],
    ["Pressure control", d.pressure_control],
    ...((d.assets ?? []).map((a) => ["Also assigned", a] as [string, string])),
  ];
  return rows.filter((r): r is [string, string] => Boolean(r[1] && String(r[1]).trim()));
}
