import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { isWritable } from "@/lib/saas/entitlements";
import { saasDb } from "@/lib/saas/db";
import { afterState, boardGroups, jobState, outNow, tooSoon, type Phase } from "@/lib/saas/jobs";
import { fmtTime as time, fmtWhen, dayHeading, dayKey } from "@/lib/saas/format";

// The layout's "%s · SYNNR" doesn't reach a page in its own folder.
export const metadata = { title: { absolute: "SYNNR" } };
export const dynamic = "force-dynamic";

type Row = {
  id: string; job_type: string; truck: string | null; status: "loading" | "ready"; ready_by: string | null; ready_at: string | null; first_ready_at: string | null;
  created_at: string; created_by_name: string | null;
  synnr_job_lines: { label: string; qty: number; critical: boolean; phase: Phase; on_at: string | null; on_by: string | null; photo_path: string | null }[] | null;
};

const clock = () => Date.now();

/** The board lists the last week of trucks. "Older jobs" opens the last six months, so a job (and its customer link) is never out of reach. */
const RECENT_DAYS = 7;
const OLDER_DAYS = 180;
const RECENT_MAX = 300;
const OLDER_MAX = 600;
/** "Needs a look" reaches further back than the list does: a truck that owes a photo doesn't stop owing it because a week went by, or because the yard got busy. */
const LOOK_DAYS = 45;
/** How many days of history are open; the rest fold up under their date. */
const OPEN_DAYS = 2;

const JOB = "id, job_type, truck, status, ready_by, ready_at, first_ready_at, created_at, created_by_name, synnr_job_lines(label, qty, critical, phase, on_at, on_by, photo_path)";

/**
 * Home: where every truck stands, in the order a manager needs it. First
 * what needs a look (a truck that went out and still owes a photo, or one
 * that was started and never called ready). Then what's loading out now, as
 * big cards, because that's where a hand taps in. Then every truck that went
 * out, one line each, by day. Every number on this screen is counted from
 * the jobs below it.
 */
export default async function JobsHome({ searchParams }: { searchParams: Promise<{ welcome?: string; joined?: string; older?: string }> }) {
  const { company } = await requireCompany();
  const { welcome, joined, older } = await searchParams;
  const db = await saasDb();
  const now = clock();
  const showOlder = older === "1";
  const max = showOlder ? OLDER_MAX : RECENT_MAX;
  const since = new Date(now - (showOlder ? OLDER_DAYS : RECENT_DAYS) * 86400e3).toISOString();
  const lookSince = new Date(now - LOOK_DAYS * 86400e3).toISOString();
  const [{ data }, { count: listCount }, { count: before }, { data: owing }, { data: waiting }] = await Promise.all([
    db.from("synnr_jobs").select(JOB).eq("company_id", company.id).gte("created_at", since).order("created_at", { ascending: false }).limit(max),
    db.from("saas_packages").select("id", { count: "exact", head: true }).eq("company_id", company.id).is("unit_id", null),
    // Jobs from before this screen's window: there's a way to them below.
    db.from("synnr_jobs").select("id", { count: "exact", head: true }).eq("company_id", company.id).lt("created_at", since),
    // Every after-the-job check still without a photo, however old or however far down the list its job is.
    db.from("synnr_job_lines").select("job_id").eq("company_id", company.id).eq("phase", "after").is("on_at", null).gte("created_at", lookSince).limit(3000),
    // Every job that was started and never called ready.
    db.from("synnr_jobs").select(JOB).eq("company_id", company.id).is("first_ready_at", null).gte("created_at", lookSince).order("created_at", { ascending: false }).limit(200),
  ]);
  const listed = (data ?? []) as Row[];
  const cut = listed.length >= max;
  // Jobs that owe a photo but aren't in the list above: fetch those too, so nothing owed is ever hidden.
  const have = new Set([...listed, ...((waiting ?? []) as Row[])].map((j) => j.id));
  const missing = [...new Set(((owing ?? []) as { job_id: string }[]).map((l) => l.job_id))].filter((id) => !have.has(id)).slice(0, 200);
  const { data: extra } = missing.length
    ? await db.from("synnr_jobs").select(JOB).eq("company_id", company.id).in("id", missing).not("first_ready_at", "is", null)
    : { data: [] };
  const seen = new Set<string>();
  const every = [...listed, ...((waiting ?? []) as Row[]), ...((extra ?? []) as Row[])].filter((j) => (seen.has(j.id) ? false : (seen.add(j.id), true)));
  const jobs = every.map((j) => ({ ...j, s: jobState(j.synnr_job_lines ?? []), a: afterState(j.synnr_job_lines ?? []), photos: (j.synnr_job_lines ?? []).filter((l) => l.photo_path).length }));
  const groups = boardGroups(jobs, now);
  const { owed, stale, live } = groups;
  // The day-by-day list is only the window; what needs a look reaches further back.
  const went = groups.went.filter((j) => j.created_at >= since);
  const criticalOff = live.reduce((n, j) => n + j.s.criticalMissing, 0);
  const today = dayKey(new Date(now).toISOString());
  const wentToday = went.filter((j) => dayKey(j.first_ready_at) === today).length;
  const usesAfter = jobs.some((j) => j.a.total > 0);
  const isEmpty = jobs.length === 0;
  const manager = company.role !== "member";
  const writable = isWritable(company.subscription_status, company.comped);

  // Trucks that went out, a day at a time, newest day first.
  const days: { key: string; heading: string; jobs: typeof went }[] = [];
  for (const j of went) {
    const key = dayKey(j.first_ready_at);
    const last = days[days.length - 1];
    if (last && last.key === key) last.jobs.push(j);
    else days.push({ key, heading: dayHeading(j.first_ready_at, now), jobs: [j] });
  }

  const stat = (n: number, label: string, tone = "text-ink") => (
    <div className="flex items-baseline gap-2.5 bg-[#0b0c0e] px-5 py-4 sm:px-6 sm:py-5">
      <span className={`text-[34px] font-light leading-none tracking-[-0.03em] tabular-nums sm:text-[44px] ${tone}`}>{n}</span>
      <span className="text-[13px] leading-tight text-ink-dim">{label}</span>
    </div>
  );
  const name = (j: { truck: string | null; job_type: string }) => j.truck || j.job_type;
  const when = (iso: string | null) => `${dayHeading(iso, now)} ${time(iso)}`;

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

      {!isEmpty ? (
        <div className={`mt-6 grid gap-px overflow-hidden rounded-2xl border border-line-2 bg-line ${usesAfter ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"}`}>
          {stat(live.length, "loading out now")}
          {stat(wentToday, "went out today", wentToday ? "text-emerald-400" : "text-ink")}
          {stat(criticalOff, "critical pieces still off", criticalOff ? "text-bone" : "text-ink")}
          {usesAfter ? stat(owed.length, owed.length === 1 ? "truck owes a photo after the job" : "trucks owe a photo after the job", owed.length ? "text-bone" : "text-ink") : null}
        </div>
      ) : null}

      {isEmpty ? (
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

      {/* What needs a look: a photo still owed, or a truck that was never called ready. */}
      {owed.length || stale.length ? (
        <section className="mt-8">
          <h2 className="text-[15px] font-medium text-ink">Needs a look</h2>
          <p className="mt-1 text-[13px] text-ink-faint">Trucks that went out and still owe a photo after the job, and trucks loaded but never called ready.</p>
          <ul className="mt-3 overflow-hidden rounded-2xl border border-line-2">
            {owed.map((j) => (
              <li key={j.id} className="border-b border-line last:border-b-0">
                <Link href={`/app/jobs/${j.id}`} className="flex items-center justify-between gap-4 bg-surface px-4 py-3.5 transition-colors hover:bg-elevated sm:px-5">
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] text-ink">{name(j)}{j.truck ? <span className="text-ink-dim"> · {j.job_type}</span> : null}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-dim">Cleared {when(j.first_ready_at)}{j.ready_by ? ` · ${j.ready_by}` : ""}</span>
                  </span>
                  <span className="shrink-0 text-right text-[13px] text-bone">{j.a.left} of {j.a.total} no photo</span>
                </Link>
              </li>
            ))}
            {stale.map((j) => (
              <li key={j.id} className="border-b border-line last:border-b-0">
                <Link href={`/app/jobs/${j.id}`} className="flex items-center justify-between gap-4 bg-surface px-4 py-3.5 transition-colors hover:bg-elevated sm:px-5">
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] text-ink">{name(j)}{j.truck ? <span className="text-ink-dim"> · {j.job_type}</span> : null}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-dim">Started {when(j.created_at)}{j.created_by_name ? ` · ${j.created_by_name}` : ""}. {j.s.on} of {j.s.total} on.</span>
                  </span>
                  <span className="shrink-0 text-right text-[13px] text-red-300">Never called ready</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Loading out now: the cards a hand taps into. */}
      {live.length ? (
        <section className="mt-8">
          <h2 className="text-[15px] font-medium text-ink">Loading out</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {live.map((j) => {
              const pct = j.s.total ? Math.round((j.s.on / j.s.total) * 100) : 0;
              return (
                <Link key={j.id} href={`/app/jobs/${j.id}`}
                  className="group flex flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-2 hover:bg-elevated">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[20px] font-medium tracking-[-0.015em] text-ink">{name(j)}</div>
                      <div className="mt-0.5 truncate text-[14px] text-ink-dim">{j.truck ? j.job_type : "No truck picked"}</div>
                    </div>
                    <span className="flex shrink-0 items-center gap-2 rounded-full border border-line-2 px-3 py-1 text-[12px] text-ink-dim">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Not ready
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline gap-2.5">
                    <span className="text-[34px] font-light leading-none tracking-[-0.03em] text-ink tabular-nums">{j.s.on}<span className="text-ink-faint"> / {j.s.total}</span></span>
                    <span className="text-[13px] text-ink-dim">on the truck</span>
                  </div>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-ink-dim" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
                    <span className={j.s.criticalMissing ? "text-bone" : "text-ink-dim"}>
                      {j.s.total === 0 ? "No list yet"
                        : j.s.criticalMissing ? `${j.s.criticalMissing} critical still off`
                          : j.s.ready ? "Everything's on. Not called ready yet." : `${j.s.missing.length} still off`}
                    </span>
                    <span className="shrink-0 text-ink-faint">Started {time(j.created_at)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Every truck that went out, one line each, a day at a time. The last two days are open; older ones fold up under their date. */}
      {days.map((d, i) => {
        const owes = d.jobs.filter((j) => j.a.left > 0 && !outNow(j, now)).length;
        const count = `${d.jobs.length} ${d.jobs.length === 1 ? "truck" : "trucks"} went out`;
        const list = (
          <ul className="mt-3 overflow-hidden rounded-2xl border border-line">
            {d.jobs.map((j) => (
              <li key={j.id} className="border-b border-line last:border-b-0">
                <Link href={`/app/jobs/${j.id}`} className="flex items-center gap-3 bg-surface px-4 py-3 transition-colors hover:bg-elevated sm:px-5">
                  <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${j.status === "ready" ? "bg-emerald-400" : "bg-red-400"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-ink">{name(j)}{j.truck ? <span className="text-ink-dim"> · {j.job_type}</span> : null}</span>
                    <span className="mt-0.5 block truncate text-[13px] text-ink-faint">
                      {time(j.first_ready_at)}{j.ready_by ? ` · ${j.ready_by}` : ""}
                      {j.status !== "ready" ? <span className="text-red-300">{` · Not ready now: ${j.s.missing.length} off`}</span> : null}
                    </span>
                  </span>
                  {(() => {
                    // Put-away photos taken within the hour the truck was cleared were taken before the job.
                    const early = j.a.left ? null : tooSoon(j.first_ready_at, j.a.last_at);
                    return (
                      <span className={`shrink-0 text-right text-[13px] ${(j.a.left && !outNow(j, now)) || early !== null ? "text-bone" : "text-ink-faint"}`}>
                        {j.a.total === 0 ? "Nothing to prove after"
                          : outNow(j, now) ? "Out now"
                            : j.a.left ? `${j.a.left} of ${j.a.total} no photo`
                            : early !== null ? `Photos ${early} min after clearing`
                              : `Put away, ${dayKey(j.a.last_at) === dayKey(j.first_ready_at) ? time(j.a.last_at) : fmtWhen(j.a.last_at)}`}
                      </span>
                    );
                  })()}
                </Link>
              </li>
            ))}
          </ul>
        );
        return i < OPEN_DAYS ? (
          <section key={d.key} className="mt-8">
            <h2 className="flex items-baseline justify-between gap-3 text-[15px] font-medium text-ink">
              <span>{d.heading}</span>
              <span className="text-[13px] font-normal text-ink-faint">{count}</span>
            </h2>
            {list}
          </section>
        ) : (
          <details key={d.key} className={`group ${i === OPEN_DAYS ? "mt-8" : "mt-2"}`}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 text-[15px] text-ink transition-colors hover:bg-elevated sm:px-5 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2.5"><ChevronRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-open:rotate-90" />{d.heading}</span>
              <span className="text-right text-[13px] text-ink-faint">{count}{owes ? <span className="text-bone">{`, ${owes} ${owes === 1 ? "owes" : "owe"} a photo`}</span> : null}</span>
            </summary>
            {list}
          </details>
        );
      })}

      {cut || before || showOlder ? (
        <p className="mt-9 text-[13px] leading-relaxed text-ink-faint">
          {cut ? `Showing the newest ${max} jobs. ` : showOlder ? "Showing the last six months. " : ""}
          {showOlder
            ? <Link href="/app" className="inline-flex min-h-9 items-center text-ink-dim underline underline-offset-4 hover:text-ink">Back to the last week</Link>
            : before ? <Link href="/app?older=1" className="inline-flex min-h-9 items-center text-ink-dim underline underline-offset-4 hover:text-ink">{before === 1 ? "1 older job" : `${before} older jobs`}</Link> : null}
        </p>
      ) : null}
    </div>
  );
}
