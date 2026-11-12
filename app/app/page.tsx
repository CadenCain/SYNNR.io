import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { isWritable } from "@/lib/saas/entitlements";
import { saasDb } from "@/lib/saas/db";
import { afterState, jobState, type Phase } from "@/lib/saas/jobs";
import { fmtTime as time, fmtDay as day, fmtWhen } from "@/lib/saas/format";

// The layout's "%s · SYNNR" doesn't reach a page in its own folder.
export const metadata = { title: { absolute: "SYNNR" } };
export const dynamic = "force-dynamic";

type Row = {
  id: string; job_type: string; truck: string | null; status: "loading" | "ready"; ready_by: string | null; ready_at: string | null; first_ready_at: string | null; created_at: string;
  synnr_job_lines: { label: string; qty: number; critical: boolean; phase: Phase; on_at: string | null; on_by: string | null; photo_path: string | null }[] | null;
};

const clock = () => Date.now();

/** The board shows the last two weeks. "Older jobs" opens the last six months, so a job (and its customer link) is never out of reach. */
const RECENT_DAYS = 14;
const OLDER_DAYS = 180;
const RECENT_MAX = 80;
const OLDER_MAX = 300;

/**
 * Home: every job the crew is loading for, and where each truck stands.
 * Loading out first (what still needs something), then what's been cleared.
 * Every number on this screen is counted from the jobs below it.
 */
export default async function JobsHome({ searchParams }: { searchParams: Promise<{ welcome?: string; joined?: string; older?: string }> }) {
  const { company } = await requireCompany();
  const { welcome, joined, older } = await searchParams;
  const db = await saasDb();
  const showOlder = older === "1";
  const max = showOlder ? OLDER_MAX : RECENT_MAX;
  const since = new Date(clock() - (showOlder ? OLDER_DAYS : RECENT_DAYS) * 86400e3).toISOString();
  const [{ data }, { count: listCount }, { count: before }] = await Promise.all([
    db.from("synnr_jobs").select("id, job_type, truck, status, ready_by, ready_at, first_ready_at, created_at, synnr_job_lines(label, qty, critical, phase, on_at, on_by, photo_path)")
      .eq("company_id", company.id).gte("created_at", since).order("created_at", { ascending: false }).limit(max),
    db.from("saas_packages").select("id", { count: "exact", head: true }).eq("company_id", company.id).is("unit_id", null),
    // Jobs from before this screen's window: there's a way to them below.
    db.from("synnr_jobs").select("id", { count: "exact", head: true }).eq("company_id", company.id).lt("created_at", since),
  ]);
  const cut = (data ?? []).length >= max;
  const jobs = ((data ?? []) as Row[]).map((j) => ({ ...j, s: jobState(j.synnr_job_lines ?? []), a: afterState(j.synnr_job_lines ?? []), photos: (j.synnr_job_lines ?? []).filter((l) => l.photo_path).length }));
  const loading = jobs.filter((j) => j.status !== "ready");
  const ready = jobs.filter((j) => j.status === "ready");
  const criticalOff = loading.reduce((n, j) => n + j.s.criticalMissing, 0);
  // After the job: what the trucks that went out still owe a photo of. A
  // truck that went out counts even if a stray tap has since taken it back
  // to NOT READY.
  const usesAfter = jobs.some((j) => j.a.total > 0);
  const afterOpen = jobs.reduce((n, j) => n + (j.first_ready_at ? j.a.left : 0), 0);
  const manager = company.role !== "member";
  const writable = isWritable(company.subscription_status, company.comped);

  const stat = (n: number, label: string, tone = "text-ink") => (
    <div className="flex items-baseline gap-2.5 bg-[#0b0c0e] px-5 py-5 sm:px-6">
      <span className={`text-[40px] font-light leading-none tracking-[-0.03em] tabular-nums sm:text-[48px] ${tone}`}>{n}</span>
      <span className="text-[13px] leading-tight text-ink-dim">{label}</span>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
      {welcome || joined ? (
        <p className="mb-6 border-l-2 border-bone pl-3 text-[13px] leading-relaxed text-ink-dim">
          {welcome ? "You're in. " : `You're on the crew at ${company.name}. `}
          {manager ? <>Start by giving SYNNR <Link href="/app/brain/lists" className="text-ink underline underline-offset-4 hover:text-white">your job lists</Link>.</> : "When a job comes in, start it here."}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink md:text-[34px]">Jobs</h1>
        {writable ? (
          <Link href="/app/jobs/new" className="flex h-11 items-center gap-2 rounded-lg bg-ink px-4 text-[14px] font-medium text-coal transition-colors hover:bg-white">
            <Plus className="h-4 w-4" /> New job
          </Link>
        ) : null}
      </div>

      {jobs.length ? (
        <div className={`mt-6 grid gap-px overflow-hidden rounded-2xl border border-line-2 bg-line ${usesAfter ? "grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
          {stat(loading.length, "loading out")}
          {stat(ready.length, "ready", ready.length ? "text-emerald-400" : "text-ink")}
          {stat(criticalOff, "critical pieces still off", criticalOff ? "text-bone" : "text-ink")}
          {usesAfter ? stat(afterOpen, "to prove after the job", afterOpen ? "text-bone" : "text-ink") : null}
        </div>
      ) : null}

      {!jobs.length ? (
        <div className="mt-6 rounded-2xl border border-line-2 bg-[#0b0c0e] px-6 py-12 sm:px-10">
          <h2 className="text-[20px] font-medium tracking-[-0.01em] text-ink">No jobs yet.</h2>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-ink-dim">
            When a job comes in, start it here. SYNNR builds what to take, with the critical pieces first, and the crew taps each one onto the truck.
          </p>
          {manager && !listCount ? (
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-dim">
              First, give it your job lists: what your shop takes on each kind of job.{" "}
              <Link href="/app/brain/lists" className="text-ink underline underline-offset-4 hover:text-white">Add your job lists</Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {[["Loading out", loading] as const, ["Ready", ready] as const].map(([title, group]) => group.length ? (
        <section key={title} className="mt-9">
          <h2 className="text-[15px] font-medium text-ink">{title}</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {group.map((j) => {
              const isReady = j.status === "ready";
              const pct = j.s.total ? Math.round((j.s.on / j.s.total) * 100) : 0;
              return (
                <Link key={j.id} href={`/app/jobs/${j.id}`}
                  className="group flex flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-2 hover:bg-elevated">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[20px] font-medium tracking-[-0.015em] text-ink">{j.truck || j.job_type}</div>
                      <div className="mt-0.5 truncate text-[14px] text-ink-dim">{j.truck ? j.job_type : "No truck picked"}</div>
                    </div>
                    <span className="flex shrink-0 items-center gap-2 rounded-full border border-line-2 px-3 py-1 text-[12px] text-ink-dim">
                      <span className={`h-1.5 w-1.5 rounded-full ${isReady ? "bg-emerald-400" : "bg-red-400"}`} /> {isReady ? "Ready" : "Not ready"}
                    </span>
                  </div>
                  <div className="mt-5 flex items-baseline gap-2.5">
                    <span className="text-[34px] font-light leading-none tracking-[-0.03em] text-ink tabular-nums">{j.s.on}<span className="text-ink-faint"> / {j.s.total}</span></span>
                    <span className="text-[13px] text-ink-dim">on the truck</span>
                  </div>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
                    <div className={`h-full rounded-full ${isReady ? "bg-emerald-400" : "bg-ink-dim"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
                    <span className={isReady ? "text-emerald-400" : j.s.criticalMissing ? "text-bone" : "text-ink-dim"}>
                      {isReady ? `Cleared by ${j.ready_by ?? "someone"}${j.ready_at ? `, ${time(j.ready_at)}` : ""}`
                        : j.s.total === 0 ? "No list yet"
                          : j.s.criticalMissing ? `${j.s.criticalMissing} critical still off`
                            : j.s.ready ? "Everything's on. Not called ready yet." : `${j.s.missing.length} still off`}
                    </span>
                    <span className="shrink-0 text-ink-faint">{j.photos ? `${j.photos} ${j.photos === 1 ? "photo" : "photos"}, ` : ""}{day(j.created_at)}</span>
                  </div>
                  {j.first_ready_at && j.a.total ? (
                    <div className={`mt-2 border-t border-line pt-2 text-[13px] ${j.a.done ? "text-ink-dim" : "text-bone"}`}>
                      {j.a.done
                        ? `After the job: all proven, ${fmtWhen(j.a.last_at)}`
                        : `After the job: ${j.a.left} of ${j.a.total} still to prove`}
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null)}

      {cut || before || showOlder ? (
        <p className="mt-9 text-[13px] leading-relaxed text-ink-faint">
          {cut ? `Showing the newest ${max} jobs. ` : showOlder ? "Showing the last six months. " : ""}
          {showOlder
            ? <Link href="/app" className="inline-flex min-h-9 items-center text-ink-dim underline underline-offset-4 hover:text-ink">Back to the last two weeks</Link>
            : before ? <Link href="/app?older=1" className="inline-flex min-h-9 items-center text-ink-dim underline underline-offset-4 hover:text-ink">{before === 1 ? "1 older job" : `${before} older jobs`}</Link> : null}
        </p>
      ) : null}
    </div>
  );
}
