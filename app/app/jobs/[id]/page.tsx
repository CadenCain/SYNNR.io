import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { isWritable } from "@/lib/saas/entitlements";
import { saasAdmin, saasDb } from "@/lib/saas/db";
import { signPhotos } from "@/lib/saas/job-photos";
import { detailRows, type Job, type JobLine } from "@/lib/saas/jobs";
import { fmtWhen } from "@/lib/saas/format";
import JobCheck from "./job-check";

export const dynamic = "force-dynamic";

const JOB = "id, job_type, truck, details, remarks, source, status, ready_by, ready_at, created_by_name, created_at, share_token";

async function load(id: string) {
  const { company, user } = await requireCompany();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await saasDb();
  const [{ data: job }, { data: lines }] = await Promise.all([
    db.from("synnr_jobs").select(JOB).eq("id", id).eq("company_id", company.id).maybeSingle(),
    db.from("synnr_job_lines").select("id, label, qty, critical, why, source, phase, sort, on_by, on_at, photo_path, rented_from").eq("job_id", id).eq("company_id", company.id).order("sort").limit(500),
  ]);
  if (!job) return null;
  return { company, user, job: job as Job, lines: (lines ?? []) as JobLine[] };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const got = await load((await params).id);
  return { title: got ? [got.job.truck, got.job.job_type].filter(Boolean).join(", ") : "Job" };
}

/** One job: what the dispatch said, what to take, and whether the truck is ready. */
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const got = await load((await params).id);
  if (!got) notFound();
  const { company, user, job, lines } = got;
  const me = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || "Someone";
  const rows = detailRows(job);
  // The database has already said this person can see these lines; now make
  // the short-lived links that open their photos.
  const admin = saasAdmin();
  const signed = admin ? await signPhotos(admin, lines.map((l) => l.photo_path).filter((p): p is string => Boolean(p))) : new Map<string, string>();
  const photos: Record<string, string> = {};
  for (const l of lines) { const u = l.photo_path ? signed.get(l.photo_path) : null; if (u) photos[l.id] = u; }
  const started = fmtWhen(job.created_at);

  const remarks = (
    <div className="rounded-xl border border-line bg-surface px-5 py-4">
      <div className="text-[13px] text-ink-faint">Remarks from the dispatch</div>
      <p className="mt-2 whitespace-pre-wrap border-l-2 border-bone pl-3 text-[15px] leading-relaxed text-ink">{job.remarks}</p>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <Link href="/app" className="inline-flex min-h-9 items-center gap-1 text-[13px] text-ink-faint transition-colors hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> Jobs
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink md:text-[34px]">{job.truck || job.job_type}</h1>
        {job.truck ? <span className="text-[17px] text-ink-dim">{job.job_type}</span> : null}
      </div>
      <p className="mt-1 text-[13px] text-ink-faint">Started by {job.created_by_name ?? "someone"}, {started}{job.source === "photo" ? ", read from the dispatch" : ""}</p>

      {/* On a phone the dispatch's remarks come first: they're what gets missed. */}
      {job.remarks ? <div className="mt-6 lg:hidden">{remarks}</div> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
        <JobCheck jobId={job.id} initial={lines} photos={photos} me={me}
          initialReady={job.status === "ready" ? { by: job.ready_by, at: job.ready_at } : null}
          manager={company.role !== "member"} writable={isWritable(company.subscription_status, company.comped)}
          share={{ title: [job.truck, job.job_type].filter(Boolean).join(", "), token: job.share_token ?? null, demo: company.is_demo }} />

        {/* What the dispatch said */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          {job.remarks ? <div className="hidden lg:block">{remarks}</div> : null}
          {rows.length ? (
            <dl className="overflow-hidden rounded-xl border border-line bg-surface">
              {rows.map(([k, v], i) => (
                <div key={`${k}-${i}`} className="flex items-baseline justify-between gap-4 border-b border-line px-5 py-3 text-[14px] last:border-b-0">
                  <dt className="shrink-0 text-ink-faint">{k}</dt>
                  <dd className="min-w-0 break-words text-right text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
