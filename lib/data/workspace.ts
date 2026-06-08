import { getServerSupabase } from "@/lib/supabase/server";

export type EvidenceItem = { label: string; ok: boolean; detail: string };
export type AuditFinding = {
  id: string;
  type: "missed" | "rate" | "doc";
  title: string;
  subtitle: string;
  amount_cents: number;
  state: string;
  blocker: string | null;
  evidence: EvidenceItem[];
};
export type AuditData = {
  persist: boolean; // true when backed by a real workspace (changes are saved)
  jobNumber: string;
  jobTitle: string;
  client: string;
  closed: string;
  crew: string;
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
  greeting: string;
  jobsAudited: string;
  recovered: string;
  riskRows: RiskRow[];
  plan: string; // e.g. "Command · active" — empty when none
};

/* ----------------------------- demo fallback ----------------------------- */

const DEMO_AUDIT: AuditData = {
  persist: false,
  jobNumber: "RC-4821",
  jobTitle: "Standby & rigging — Pad 14 turnaround",
  client: "Apex Midstream · MSA #882",
  closed: "Closed Aug 14, 2025",
  crew: "Crew B-7 · Mike Ross",
  findings: [
    { id: "f1", type: "missed", title: "Unbilled standby hours", subtitle: "Ticket vs invoice delta · 6.5 hrs", amount_cents: 143000, state: "open", blocker: null,
      evidence: [{ label: "Field ticket", ok: true, detail: "6.5 standby hrs logged + signed" }, { label: "Invoice as drafted", ok: false, detail: "0 standby hrs billed" }] },
    { id: "f2", type: "rate", title: "Rate billed below MSA", subtitle: "Crane & rigging · MSA #882", amount_cents: 218000, state: "open", blocker: null,
      evidence: [{ label: "Billed rate", ok: false, detail: "$1,250 / day × 4 days = $5,000" }, { label: "Contract rate (MSA)", ok: true, detail: "$1,795 / day × 4 days = $7,180" }] },
    { id: "f3", type: "missed", title: "Consumables not reconciled", subtitle: "42 line items vs pricebook", amount_cents: 96000, state: "open", blocker: null,
      evidence: [{ label: "Pricebook match", ok: true, detail: "42 items priced & backed" }, { label: "Invoice as drafted", ok: false, detail: "Consumables omitted" }] },
    { id: "f4", type: "doc", title: "Missing field photos", subtitle: "3 of 5 backup images absent", amount_cents: 0, state: "open", blocker: "backup", evidence: [] },
    { id: "f5", type: "doc", title: "Unsigned service ticket", subtitle: "Customer sign-off pending", amount_cents: 0, state: "open", blocker: "sign", evidence: [] },
  ],
};

const DEMO_DASHBOARD: DashboardData = {
  live: false,
  greeting: "Ray",
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

export async function getAuditData(): Promise<AuditData> {
  const supabase = await getServerSupabase();
  if (!supabase) return DEMO_AUDIT;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return DEMO_AUDIT;

  const { data: job } = await supabase
    .from("jobs")
    .select("id, number, title, closed_at, client_id, crew_id")
    .order("recoverable_cents", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!job) return DEMO_AUDIT;

  const { data: findings } = await supabase
    .from("findings")
    .select("id, type, title, subtitle, amount_cents, state, blocker, evidence")
    .eq("job_id", job.id)
    .order("created_at", { ascending: true });
  if (!findings || findings.length === 0) return DEMO_AUDIT;

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

  return {
    persist: true,
    jobNumber: job.number,
    jobTitle: job.title,
    client: client ? `${client.name}${client.msa_number ? " · " + client.msa_number : ""}` : "—",
    closed: `Closed ${closedAt}`,
    crew: crew ? `${crew.name}${crew.lead ? " · " + crew.lead : ""}` : "—",
    findings: findings.map((f) => ({
      id: f.id,
      type: f.type,
      title: f.title,
      subtitle: f.subtitle ?? "",
      amount_cents: f.amount_cents,
      state: f.state,
      blocker: f.blocker,
      evidence: Array.isArray(f.evidence) ? (f.evidence as unknown as EvidenceItem[]) : [],
    })),
  };
}

export type ReportData = {
  live: boolean;
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

  if (!findings || findings.length === 0) return DEMO_REPORT;

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

  const [{ data: profile }, { count }, { data: runs }, { data: jobs }, { data: sub }] = await Promise.all([
    supabase.from("profiles").select("name, email").eq("id", auth.user.id).maybeSingle(),
    supabase.from("jobs").select("id", { count: "exact", head: true }),
    supabase.from("audit_runs").select("recovered_cents"),
    supabase.from("jobs").select("id, number, title, status, priority, closed_at").order("closed_at", { ascending: false }).limit(5),
    supabase.from("subscriptions").select("plan, status").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (!jobs) return DEMO_DASHBOARD;

  const planNames: Record<string, string> = { recover: "Recover", command: "Command" };
  const plan = sub?.plan ? `${planNames[sub.plan] || sub.plan}${sub.status ? " · " + sub.status : ""}` : "";

  const name =
    profile?.name?.split(" ")[0] ||
    profile?.email?.split("@")[0] ||
    auth.user.email?.split("@")[0] ||
    "there";
  const recovered = (runs ?? []).reduce((s, r) => s + (r.recovered_cents ?? 0), 0);

  return {
    live: true,
    greeting: name.charAt(0).toUpperCase() + name.slice(1),
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
