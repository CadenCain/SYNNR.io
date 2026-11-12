/**
 * A job in SYNNR: what was read off the dispatch, the list of what it takes,
 * and whether the truck is ready. Pure rules, shared by the phone and the
 * server, so both always agree.
 */

export type LineSource = "list" | "dispatch" | "added";

/**
 * Where a line sits in the job. "load" is a piece that goes on the truck, and
 * READY is about those only. "after" is something the crew proves when the
 * job is done (BOP rams closed for travel, the package washed): always a
 * photo, and it never holds a truck back from READY.
 */
export type Phase = "load" | "after";

export type JobLine = {
  id: string;
  label: string;
  qty: number;
  critical: boolean;
  why: string | null;
  source: LineSource;
  phase: Phase;
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
  /** The link sent to the customer, when there is one. */
  share_token?: string | null;
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

const isAfter = (l: { phase?: Phase }) => l.phase === "after";

/** The pieces that go on the truck, without what's proven after the job. */
export const loadLines = <T extends { phase?: Phase }>(lines: T[]): T[] => lines.filter((l) => !isAfter(l));
/** What the crew proves when the job is done. */
export const afterLines = <T extends { phase?: Phase }>(lines: T[]): T[] => lines.filter(isAfter);

/** READY only when there's a list and every piece on it is on the truck. What's proven after the job doesn't count here. */
export function jobState(all: (Pick<JobLine, "label" | "qty" | "critical" | "on_at"> & { phase?: Phase })[]) {
  const lines = loadLines(all);
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
 * After the job: how many of the checks have their photo, and when the last
 * one went in. "done" only when there are checks and every one has a photo.
 */
export function afterState(all: (Pick<JobLine, "on_at"> & { on_by?: string | null; phase?: Phase })[]) {
  const lines = afterLines(all);
  const proven = lines.filter((l) => l.on_at);
  const last = proven.reduce<(typeof proven)[number] | null>((m, l) => (!m || (l.on_at as string) > (m.on_at as string) ? l : m), null);
  return {
    total: lines.length,
    proven: proven.length,
    left: lines.length - proven.length,
    done: lines.length > 0 && proven.length === lines.length,
    last_at: last?.on_at ?? null,
    last_by: last?.on_by ?? null,
  };
}

/**
 * The list for a new job: the shop's own list for that kind of job, then
 * whatever the dispatch itself called out. A callout the shop's list already
 * has isn't added twice; it marks that line critical and carries the reason.
 */
export function buildLines(input: { list: { label: string; qty: number; critical: boolean; phase?: Phase }[]; callouts: Callout[] }): NewLine[] {
  const out: NewLine[] = [];
  const at = new Map<string, number>();
  const after = new Set<string>();
  for (const l of input.list) {
    const label = l.label.trim().slice(0, 120);
    if (!label) continue;
    // Something proven after the job: its own line, always with a photo, never matched to a dispatch callout.
    if (l.phase === "after") {
      if (after.has(norm(label))) continue;
      after.add(norm(label));
      out.push({ label, qty: 1, critical: true, why: null, source: "list", phase: "after", sort: out.length });
      continue;
    }
    if (at.has(norm(label))) continue;
    at.set(norm(label), out.length);
    out.push({ label, qty: clampQty(l.qty), critical: Boolean(l.critical), why: null, source: "list", phase: "load", sort: out.length });
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
    out.push({ label, qty: clampQty(c.qty), critical: true, why, source: "dispatch", phase: "load", sort: out.length });
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

/** A first name is enough for a customer to know who loaded it. Last names stay in the shop. */
export const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "Someone";

/** One line as a customer sees it through the job's link. */
export type SharedLine = {
  label: string; qty: number; critical: boolean; why: string | null;
  on_by: string | null; on_at: string | null;
  /** Where the customer's browser gets the proof photo: a page of ours, never where the photo is kept. */
  photo: string | null;
};

/**
 * The list as it goes out on a job's link: in loading order, first names
 * only, and each proof photo as an address the caller picks rather than its
 * place in storage. Nothing else about the line leaves the shop, and what
 * the crew proves after the job (washing, putting away) is the shop's own
 * business: it never goes out on the link.
 */
export function sharedLines(lines: JobLine[], photoUrl: (line: JobLine) => string | null | undefined): SharedLine[] {
  return orderLines(loadLines(lines)).map((l) => ({
    label: l.label, qty: l.qty, critical: l.critical, why: l.why,
    on_at: l.on_at, on_by: l.on_at ? firstName(l.on_by) : null,
    photo: l.on_at && l.photo_path ? photoUrl(l) ?? null : null,
  }));
}
