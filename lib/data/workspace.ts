import { getServerSupabase } from "@/lib/supabase/server";

export type EvidenceItem = { label: string; ok: boolean; detail: string };
export type FindingCategory =
  | "Rate Mismatch" | "Missing Billable" | "Missing Backup"
  | "Duplicate Charge" | "Discount Error" | "SLA Risk" | "Dispute Risk";
export type AuditFinding = {
  id: string;
  type: "missed" | "rate" | "doc";
  category: FindingCategory;
  title: string;
  subtitle: string;
  amount_cents: number;
  confidence: number; // 0-100
  state: string;
  blocker: string | null;
  evidence: EvidenceItem[];
  original?: string; // original invoice line
  corrected?: string; // corrected line
  fix?: string; // recommended correction
};
export type EvidenceType = { label: string; present: boolean };
export type AuditData = {
  persist: boolean; // true when backed by a real workspace (changes are saved)
  empty?: boolean; // authed workspace with no audited job yet
  jobNumber: string;
  jobTitle: string;
  client: string;
  location: string;
  closed: string;
  crew: string;
  invoiceStatus: string;
  risk: "High" | "Medium" | "Low";
  readiness: number; // invoice readiness 0-100
  evidenceTypes: EvidenceType[];
  findings: AuditFinding[];
};

export type RiskRow = {
  id: string;
  number: string;
  subject: string;
  priority: "high" | "med" | "low";
  status: "review" | "delivered" | "open" | "resolved";
  date: string;
};
export type DashboardData = {
  live: boolean;
  empty: boolean; // authed workspace with no data yet
  greeting: string;
  recoverableMonth: string; // hero metric — money found this month
  atRisk: string; // unapproved findings + missing backup
  jobsAudited: string;
  recovered: string;
  riskRows: RiskRow[];
  plan: string; // e.g. "Command · active" — empty when none
};

/* ----------------------------- demo fallback ----------------------------- */

const DEMO_AUDIT: AuditData = {
  persist: false,
  jobNumber: "RC-4821",
  jobTitle: "Crane & rigging — Pad 14 turnaround",
  client: "Apex Midstream · MSA #882",
  location: "Pad 14 · Permian Basin, TX",
  closed: "Closed Aug 14, 2025",
  crew: "Crew B-7 · Mike Ross",
  invoiceStatus: "Draft — not yet sent",
  risk: "High",
  readiness: 64,
  evidenceTypes: [
    { label: "Signed field ticket", present: true },
    { label: "Field photos", present: false },
    { label: "Rate sheet", present: true },
    { label: "Customer MSA", present: true },
    { label: "Time log", present: true },
    { label: "Equipment usage", present: true },
    { label: "Draft invoice", present: true },
  ],
  findings: [
    {
      id: "f1", type: "rate", category: "Rate Mismatch",
      title: "Crane support billed below MSA rate", subtitle: "6 hrs · crane & rigging",
      amount_cents: 75000, confidence: 98, state: "open", blocker: null,
      original: "6 hrs × $250/hr = $1,500", corrected: "6 hrs × $375/hr = $2,250 (MSA #882)",
      fix: "Re-rate crane support to the contracted $375/hr — adds $750.",
      evidence: [
        { label: "Draft invoice", ok: false, detail: "Crane @ $250/hr" },
        { label: "Customer MSA #882", ok: true, detail: "Crane support = $375/hr" },
      ],
    },
    {
      id: "f2", type: "missed", category: "Missing Billable",
      title: "Rigging support never invoiced", subtitle: "Crew on ticket, absent from invoice",
      amount_cents: 120000, confidence: 95, state: "open", blocker: null,
      original: "Not on invoice", corrected: "Rigging crew · 8 hrs = $1,200",
      fix: "Add rigging support line ($1,200) — on the signed ticket, missing from the draft.",
      evidence: [
        { label: "Signed field ticket", ok: true, detail: "Rigging crew · 8 hrs logged" },
        { label: "Draft invoice", ok: false, detail: "No rigging line" },
      ],
    },
    {
      id: "f3", type: "missed", category: "Missing Billable",
      title: "Standby time not captured", subtitle: "Waiting on company man · 4.5 hrs",
      amount_cents: 81000, confidence: 92, state: "open", blocker: null,
      original: "0 hrs billed", corrected: "4.5 hrs × $180/hr = $810",
      fix: "Bill 4.5 standby hrs at the MSA standby rate — adds $810.",
      evidence: [
        { label: "Time log", ok: true, detail: "Standby 11:20–15:50 (4.5 hrs)" },
        { label: "Draft invoice", ok: false, detail: "No standby line" },
      ],
    },
    {
      id: "f4", type: "missed", category: "Missing Billable",
      title: "Fuel surcharge omitted", subtitle: "Applies per MSA on equipment-haul jobs",
      amount_cents: 64000, confidence: 88, state: "open", blocker: null,
      original: "Omitted", corrected: "Fuel surcharge = $640",
      fix: "Apply the contracted fuel surcharge — adds $640.",
      evidence: [
        { label: "Customer MSA #882", ok: true, detail: "Fuel surcharge clause 4.2" },
        { label: "Equipment usage", ok: true, detail: "Haul + crane mobilization logged" },
      ],
    },
    {
      id: "f5", type: "missed", category: "Missing Billable",
      title: "Equipment support not added", subtitle: "Crane pads & matting",
      amount_cents: 117000, confidence: 90, state: "open", blocker: null,
      original: "Not on invoice", corrected: "Crane pads / matting = $1,170",
      fix: "Add equipment-support line ($1,170) shown in equipment usage.",
      evidence: [
        { label: "Equipment usage", ok: true, detail: "Matting + crane pads deployed" },
        { label: "Draft invoice", ok: false, detail: "No equipment-support line" },
      ],
    },
    {
      id: "f6", type: "doc", category: "Missing Backup",
      title: "Field photos incomplete", subtitle: "2 of 5 required backup images",
      amount_cents: 0, confidence: 99, state: "open", blocker: "backup",
      fix: "Request the 3 missing site photos from the crew before sending.",
      evidence: [{ label: "Photo set", ok: false, detail: "2 of 5 attached" }],
    },
    {
      id: "f7", type: "doc", category: "SLA Risk",
      title: "Invoice approaching SLA window", subtitle: "Bill-by date in 6 days",
      amount_cents: 0, confidence: 100, state: "open", blocker: "sign",
      fix: "Finalize and send within the MSA billing window to avoid short-pay risk.",
      evidence: [{ label: "MSA #882", ok: true, detail: "Net-15 bill-by clause" }],
    },
  ],
};

const DEMO_DASHBOARD: DashboardData = {
  live: false,
  greeting: "Ray",
  recoverableMonth: "$48,200",
  atRisk: "$31,900",
  jobsAudited: "3,484",
  recovered: "$284,750",
  riskRows: [
    { id: "d1", number: "#2319", subject: "Payment failed on invoice", priority: "high", status: "review", date: "2025-08-18" },
    { id: "d2", number: "#2320", subject: "Missing signature on service ticket", priority: "med", status: "delivered", date: "2025-08-19" },
    { id: "d3", number: "#2321", subject: "Standby hours unbilled", priority: "high", status: "open", date: "2025-08-19" },
    { id: "d4", number: "#2322", subject: "Rate below MSA contract", priority: "med", status: "resolved", date: "2025-08-20" },
    { id: "d5", number: "#2323", subject: "Field photos missing from packet", priority: "high", status: "review", date: "2025-08-20" },
  ],
  plan: "",
  empty: false,
};

const usd = (cents: number) => "$" + Math.round(cents / 100).toLocaleString("en-US");

function statusOf(s: string): RiskRow["status"] {
  if (s === "in_review") return "review";
  if (s === "delivered") return "delivered";
  if (s === "resolved") return "resolved";
  return "open";
}
function prioOf(p: string): RiskRow["priority"] {
  return p === "high" ? "high" : p === "low" ? "low" : "med";
}

/* ----------------------------- live readers ----------------------------- */

const EMPTY_AUDIT: AuditData = {
  persist: true, empty: true, jobNumber: "", jobTitle: "", client: "", location: "", closed: "", crew: "",
  invoiceStatus: "", risk: "Low", readiness: 0, evidenceTypes: [], findings: [],
};

function categoryOf(type: string, blocker: string | null): FindingCategory {
  if (type === "rate") return "Rate Mismatch";
  if (type === "missed") return "Missing Billable";
  if (blocker === "sign") return "Dispute Risk";
  return "Missing Backup";
}

export async function getAuditData(): Promise<AuditData> {
  const supabase = await getServerSupabase();
  if (!supabase) return DEMO_AUDIT; // unconfigured -> demo
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return DEMO_AUDIT; // signed out -> demo

  const { data: job } = await supabase
    .from("jobs")
    .select("id, number, title, closed_at, client_id, crew_id")
    .order("recoverable_cents", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!job) return EMPTY_AUDIT; // authed, nothing audited yet

  const { data: findings } = await supabase
    .from("findings")
    .select("id, type, title, subtitle, amount_cents, state, blocker, evidence")
    .eq("job_id", job.id)
    .order("created_at", { ascending: true });
  if (!findings || findings.length === 0) return EMPTY_AUDIT;

  const [{ data: client }, { data: crew }] = await Promise.all([
    job.client_id
      ? supabase.from("clients").select("name, msa_number").eq("id", job.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    job.crew_id
      ? supabase.from("crews").select("name, lead").eq("id", job.crew_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const closedAt = job.closed_at
    ? new Date(job.closed_at + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "—";

  const mapped: AuditFinding[] = findings.map((f) => {
    const ev = Array.isArray(f.evidence) ? (f.evidence as unknown as EvidenceItem[]) : [];
    return {
      id: f.id,
      type: f.type,
      category: categoryOf(f.type, f.blocker),
      title: f.title,
      subtitle: f.subtitle ?? "",
      amount_cents: f.amount_cents,
      confidence: 90,
      state: f.state,
      blocker: f.blocker,
      evidence: ev,
      original: ev.find((e) => !e.ok)?.detail,
      corrected: ev.find((e) => e.ok)?.detail,
    };
  });

  const openMoney = mapped.filter((m) => m.amount_cents > 0 && m.state !== "dismissed").length;
  const blockers = mapped.filter((m) => m.blocker && m.state !== "resolved").length;
  const readiness = Math.max(0, Math.min(100, 100 - blockers * 20 - openMoney * 8));
  const risk: AuditData["risk"] = openMoney > 0 ? "High" : blockers > 0 ? "Medium" : "Low";

  return {
    persist: true,
    jobNumber: job.number,
    jobTitle: job.title,
    client: client ? `${client.name}${client.msa_number ? " · " + client.msa_number : ""}` : "—",
    location: "—",
    closed: `Closed ${closedAt}`,
    crew: crew ? `${crew.name}${crew.lead ? " · " + crew.lead : ""}` : "—",
    invoiceStatus: "Draft — not yet sent",
    risk,
    readiness,
    evidenceTypes: [
      { label: "Signed field ticket", present: !mapped.some((m) => m.blocker === "sign") },
      { label: "Field photos", present: !mapped.some((m) => m.blocker === "backup") },
      { label: "Rate sheet", present: true },
      { label: "Customer MSA", present: true },
      { label: "Time log", present: true },
      { label: "Draft invoice", present: true },
    ],
    findings: mapped,
  };
}

export type ReportData = {
  live: boolean;
  empty?: boolean;
  workspace: string;
  foundCents: number;
  inBillingCents: number;
  recoveredCents: number;
  jobsCount: number;
  findingsCount: number;
  byType: { missedCents: number; missedCount: number; rateCents: number; rateCount: number; docCount: number };
  topJobs: { number: string; title: string; cents: number }[];
};

const DEMO_REPORT: ReportData = {
  live: false,
  workspace: "Permian Field Services",
  foundCents: 28475000,
  inBillingCents: 9120000,
  recoveredCents: 4830000,
  jobsCount: 1204,
  findingsCount: 240,
  byType: { missedCents: 14820000, missedCount: 142, rateCents: 9430000, rateCount: 37, docCount: 61 },
  topJobs: [
    { number: "RC-4821", title: "Standby & rigging — Pad 14 turnaround", cents: 457000 },
    { number: "RC-4805", title: "Tank cleanout — Yard 3", cents: 318000 },
    { number: "RC-4799", title: "Pipeline inspection", cents: 264000 },
    { number: "RC-4772", title: "Crane lift — Site B", cents: 143000 },
    { number: "RC-4760", title: "Hydro test — Pad 7", cents: 89000 },
  ],
};

export async function getReportData(): Promise<ReportData> {
  const supabase = await getServerSupabase();
  if (!supabase) return DEMO_REPORT;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return DEMO_REPORT;

  const [{ data: ws }, { data: findings }, { count: jobsCount }, { data: jobs }] = await Promise.all([
    supabase.from("workspaces").select("name").limit(1).maybeSingle(),
    supabase.from("findings").select("type, amount_cents, state"),
    supabase.from("jobs").select("id", { count: "exact", head: true }),
    supabase.from("jobs").select("number, title, recoverable_cents").order("recoverable_cents", { ascending: false }).limit(8),
  ]);

  if (!findings || findings.length === 0) {
    return {
      live: true, empty: true, workspace: ws?.name || "Your workspace",
      foundCents: 0, inBillingCents: 0, recoveredCents: 0, jobsCount: jobsCount ?? 0,
      findingsCount: 0, byType: { missedCents: 0, missedCount: 0, rateCents: 0, rateCount: 0, docCount: 0 }, topJobs: [],
    };
  }

  let found = 0, inBilling = 0, recovered = 0;
  const t = { missedCents: 0, missedCount: 0, rateCents: 0, rateCount: 0, docCount: 0 };
  for (const f of findings) {
    const amt = f.amount_cents || 0;
    if (f.state !== "dismissed") found += amt;
    if (f.state === "approved" || f.state === "recovered") inBilling += amt;
    if (f.state === "recovered") recovered += amt;
    if (f.type === "missed") { t.missedCents += amt; t.missedCount++; }
    else if (f.type === "rate") { t.rateCents += amt; t.rateCount++; }
    else t.docCount++;
  }

  return {
    live: true,
    workspace: ws?.name || "Your workspace",
    foundCents: found,
    inBillingCents: inBilling,
    recoveredCents: recovered,
    jobsCount: jobsCount ?? 0,
    findingsCount: findings.length,
    byType: t,
    topJobs: (jobs ?? []).filter((j) => (j.recoverable_cents ?? 0) > 0).map((j) => ({
      number: j.number, title: j.title, cents: j.recoverable_cents ?? 0,
    })),
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await getServerSupabase();
  if (!supabase) return DEMO_DASHBOARD;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return DEMO_DASHBOARD;

  const [{ data: profile }, { count }, { data: runs }, { data: jobs }, { data: sub }, { data: allFindings }] = await Promise.all([
    supabase.from("profiles").select("name, email").eq("id", auth.user.id).maybeSingle(),
    supabase.from("jobs").select("id", { count: "exact", head: true }),
    supabase.from("audit_runs").select("recovered_cents"),
    supabase.from("jobs").select("id, number, title, status, priority, closed_at").order("closed_at", { ascending: false }).limit(5),
    supabase.from("subscriptions").select("plan, status").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("findings").select("amount_cents, state, blocker"),
  ]);

  const planNames: Record<string, string> = { pro: "Pro", growth: "Growth", recover: "Pro", command: "Growth" };
  const plan = sub?.plan ? `${planNames[sub.plan] || sub.plan}${sub.status ? " · " + sub.status : ""}` : "";

  const nameRaw =
    profile?.name?.split(" ")[0] ||
    profile?.email?.split("@")[0] ||
    auth.user.email?.split("@")[0] ||
    "there";
  const name = nameRaw.charAt(0).toUpperCase() + nameRaw.slice(1);

  // Authed but no jobs yet -> real empty state (NOT the fake demo).
  if (!jobs || (count ?? 0) === 0) {
    return { live: true, empty: true, greeting: name, recoverableMonth: "$0", atRisk: "$0", jobsAudited: "0", recovered: "$0", riskRows: [], plan };
  }

  const recovered = (runs ?? []).reduce((s, r) => s + (r.recovered_cents ?? 0), 0);
  const findingsAll = allFindings ?? [];
  const recoverableMonthCents = findingsAll.reduce((s, f) => s + (f.state !== "dismissed" ? f.amount_cents ?? 0 : 0), 0);
  const atRiskCents = findingsAll.reduce((s, f) => s + (f.state === "open" ? f.amount_cents ?? 0 : 0), 0);

  return {
    live: true,
    empty: false,
    greeting: name,
    recoverableMonth: usd(recoverableMonthCents),
    atRisk: usd(atRiskCents),
    jobsAudited: (count ?? 0).toLocaleString("en-US"),
    recovered: recovered > 0 ? usd(recovered) : "$0",
    riskRows: jobs.map((j) => ({
      id: j.id,
      number: j.number.startsWith("#") ? j.number : "#" + j.number,
      subject: j.title,
      priority: prioOf(j.priority),
      status: statusOf(j.status),
      date: j.closed_at ?? "—",
    })),
    plan,
  };
}

// ── Module 2: Digital Yard Twin ──────────────────────────────────────────
import { STATE_TONE, loadoutStatus, daysUntil, type AssetState, type Readiness } from "@/lib/twin/fsm";

export type YardItem = {
  id: string;
  name: string;
  category: string | null;
  identifier: string | null;
  state: AssetState;
  calibrationDays: number | null;
  inspectionDays: number | null;
};
export type YardNode = {
  id: string;
  name: string;
  identifier: string | null;
  state: AssetState;
  tone: "green" | "amber" | "active" | "red";
  inspectionDays: number | null;
  crew: string | null;
  jobNumber: string | null;
  readiness: Readiness;
  readinessReason: string;
  items: YardItem[];
};
export type YardData = { live: boolean; empty: boolean; nodes: YardNode[]; loose: YardItem[]; counts: { ready: number; atRisk: number; blocked: number; maintenance: number } };

const EMPTY_YARD: YardData = { live: false, empty: true, nodes: [], loose: [], counts: { ready: 0, atRisk: 0, blocked: 0, maintenance: 0 } };

export async function getYardData(): Promise<YardData> {
  const supabase = await getServerSupabase();
  if (!supabase) return EMPTY_YARD;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return EMPTY_YARD;

  const [{ data: assets }, { data: crews }, { data: jobs }] = await Promise.all([
    supabase.from("assets").select("id, parent_asset_id, name, category, asset_kind, identifier, state, calibration_date, inspection_date, crew_id, current_job_id").order("created_at", { ascending: true }),
    supabase.from("crews").select("id, name"),
    supabase.from("jobs").select("id, number"),
  ]);
  if (!assets || assets.length === 0) return { ...EMPTY_YARD, live: true, empty: true };

  const crewName = new Map((crews ?? []).map((c) => [c.id, c.name]));
  const jobNum = new Map((jobs ?? []).map((j) => [j.id, j.number]));
  const childrenOf = new Map<string, typeof assets>();
  for (const a of assets) {
    if (a.parent_asset_id) {
      const arr = childrenOf.get(a.parent_asset_id) ?? [];
      arr.push(a);
      childrenOf.set(a.parent_asset_id, arr);
    }
  }

  const toItem = (a: (typeof assets)[number]): YardItem => ({
    id: a.id, name: a.name, category: a.category, identifier: a.identifier,
    state: a.state as AssetState, calibrationDays: daysUntil(a.calibration_date), inspectionDays: daysUntil(a.inspection_date),
  });

  const nodes: YardNode[] = [];
  const counts = { ready: 0, atRisk: 0, blocked: 0, maintenance: 0 };
  for (const a of assets) {
    if (a.asset_kind !== "node") continue;
    const kids = (childrenOf.get(a.id) ?? []).map(toItem);
    const inspDays = daysUntil(a.inspection_date);
    // "missing" = a required child marked maintenance_required (proxy for not-loadable)
    const childMissing = kids.filter((k) => k.state === "maintenance_required").length;
    const childDays = kids.map((k) => k.calibrationDays).filter((d): d is number => d != null);
    const childSoonest = childDays.length ? Math.min(...childDays) : null;
    const { status, reason } =
      a.state === "maintenance_required"
        ? { status: "blocked" as Readiness, reason: "Truck in maintenance" }
        : loadoutStatus({ childMissing, inspectionDays: inspDays, childSoonest });
    if (a.state === "maintenance_required") counts.maintenance++;
    else if (status === "ready") counts.ready++;
    else if (status === "at_risk") counts.atRisk++;
    else counts.blocked++;
    nodes.push({
      id: a.id, name: a.name, identifier: a.identifier, state: a.state as AssetState,
      tone: STATE_TONE[a.state as AssetState], inspectionDays: inspDays,
      crew: a.crew_id ? crewName.get(a.crew_id) ?? null : null,
      jobNumber: a.current_job_id ? jobNum.get(a.current_job_id) ?? null : null,
      readiness: status, readinessReason: reason, items: kids,
    });
  }
  const loose = assets.filter((a) => a.asset_kind !== "node" && !a.parent_asset_id).map(toItem);

  return { live: true, empty: false, nodes, loose, counts };
}
