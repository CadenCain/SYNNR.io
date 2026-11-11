import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/utils";
import { saasAdmin } from "@/lib/saas/db";
import { getSharedJob } from "@/lib/saas/job-share";
import { jobState } from "@/lib/saas/jobs";
import { fmtWhen } from "@/lib/saas/format";

/**
 * The page a customer opens from the link a crew sent: one job, what's on
 * the truck, and the photo of each critical piece. No login. It reads the
 * job fresh every time, so it always shows the truck as it stands, and it
 * stops working the moment a manager turns the link off.
 */
export const dynamic = "force-dynamic";

const load = cache(async (token: string) => {
  const admin = saasAdmin();
  return admin ? getSharedJob(admin, token) : null;
});

// Times carry their zone here: whoever opens this holds it up against his own clock.
const when = (iso: string | null) => (iso ? fmtWhen(iso, null) : "");

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const job = await load((await params).token);
  // Never in a search engine, and the link itself is never passed along to another site.
  const quiet = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };
  if (!job) return { ...quiet, title: "Not found · SYNNR" };
  const s = jobState(job.lines);
  const photos = job.lines.filter((l) => l.photo).length;
  const title = `${[job.truck, job.job_type].filter(Boolean).join(", ")} · ${job.company}`;
  const description = job.status === "ready"
    ? `Ready. All ${s.total} on the truck${photos ? `, ${photos} ${photos === 1 ? "photo" : "photos"} of the critical pieces` : ""}.`
    : `Not ready yet. ${s.on} of ${s.total} on the truck.`;
  return { ...quiet, title, description, openGraph: { title, description }, twitter: { card: "summary", title, description } };
}

export default async function SharedJobPage({ params }: { params: Promise<{ token: string }> }) {
  const job = await load((await params).token);
  if (!job) notFound();
  const s = jobState(job.lines);
  const ready = job.status === "ready";
  const critical = job.lines.filter((l) => l.critical);
  const proof = critical.filter((l) => l.on_at && l.photo);
  const facts = ([["Well", job.well], ["Start", job.start]] as [string, string | null][]).filter((f): f is [string, string] => Boolean(f[1]));

  return (
    <div className="saas flex min-h-dvh flex-col bg-coal text-ink antialiased">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-5 md:px-8">
        <Link href="/" aria-label="SYNNR home"><Wordmark /></Link>
        <span className="truncate text-[13px] text-ink-faint">Load-out proof</span>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 md:px-8">
        <p className="text-[14px] text-ink-dim">{job.company}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] md:text-[34px]">{job.truck || job.job_type}</h1>
          {job.truck ? <span className="text-[17px] text-ink-dim">{job.job_type}</span> : null}
        </div>
        {facts.length ? (
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[14px]">
            {facts.map(([k, v]) => (
              <div key={k} className="flex min-w-0 gap-2"><dt className="shrink-0 text-ink-faint">{k}</dt><dd className="min-w-0 break-words text-ink-dim">{v}</dd></div>
            ))}
          </dl>
        ) : null}

        {/* Where the truck stands */}
        <div className={cn("mt-6 rounded-2xl border px-5 py-5 sm:px-6", ready ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-line-2 bg-[#0b0c0e]")}>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <div className="flex items-center gap-3">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", ready ? "bg-emerald-400" : "bg-red-400")} />
                <span className={cn("text-[40px] font-light leading-none tracking-[-0.03em] sm:text-[52px]", ready ? "text-emerald-400" : "text-red-400")}>{ready ? "Ready" : "Not ready"}</span>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-dim">
                {ready
                  ? `Cleared by ${job.ready_by ?? "the crew"}${job.ready_at ? `, ${when(job.ready_at)}` : ""}. Everything on the list is on the truck.`
                  : s.total === 0
                    ? "This job has no list yet."
                    : s.ready
                      ? "Everything is on the truck. The crew hasn't called it ready yet."
                      : `${s.missing.length} still off the truck${s.criticalMissing ? `, ${s.criticalMissing} of them critical` : ""}.`}
              </p>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-[40px] font-light leading-none tracking-[-0.03em] tabular-nums sm:text-[52px]">{s.on}<span className="text-ink-faint"> / {s.total}</span></span>
              <span className="text-[13px] text-ink-dim">on the truck</span>
            </div>
          </div>
        </div>

        {/* The proof: a photo of each critical piece, taken as it went on */}
        {critical.length ? (
          <section className="mt-9">
            <h2 className="text-[15px] font-medium">Proof</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-faint">
              {proof.length} of {critical.length} critical {critical.length === 1 ? "piece" : "pieces"} photographed going on the truck. A critical piece can&apos;t be marked on without its photo.
            </p>
            {proof.length ? (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {proof.map((l, i) => (
                  <li key={i}>
                    <a href={l.photo!} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-2">
                      {/* Served under the link itself, straight from the shop's private photos: no image resizer in between. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.photo!} alt={`Photo of ${l.label}`} referrerPolicy="no-referrer" loading="lazy" className="aspect-[4/3] w-full bg-coal object-cover" />
                      <span className="block px-3 py-2.5">
                        <span className="block text-[13px] leading-snug text-ink">{l.label}{l.qty > 1 ? <span className="text-ink-faint"> × {l.qty}</span> : null}</span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-ink-faint">{l.on_by}, {when(l.on_at)}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {/* The whole list */}
        <section className="mt-9">
          <h2 className="text-[15px] font-medium">The list</h2>
          <ul className="mt-3 overflow-hidden rounded-xl border border-line">
            {job.lines.length === 0 ? (
              <li className="bg-surface px-5 py-8 text-center text-[14px] text-ink-dim">Nothing on the list yet.</li>
            ) : job.lines.map((l, i) => {
              const on = Boolean(l.on_at);
              return (
                <li key={i} className="flex items-center gap-4 border-b border-line bg-surface px-4 py-3 last:border-b-0 sm:px-5">
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
                    on ? "border-emerald-400 bg-emerald-400 text-coal" : l.critical ? "border-bone" : "border-line-2")}>
                    {on ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] leading-snug">{l.label}{l.qty > 1 ? <span className="text-ink-faint"> × {l.qty}</span> : null}</span>
                    {l.why ? <span className="mt-0.5 block text-[13px] leading-snug text-ink-dim">Dispatch: {l.why}</span> : null}
                    <span className={cn("mt-0.5 block text-[12px]", on ? "text-ink-faint" : l.critical ? "text-bone" : "text-ink-faint")}>
                      {on ? `On the truck: ${l.on_by}, ${when(l.on_at)}` : "Not on the truck yet"}
                    </span>
                  </span>
                  {l.critical ? <span className={cn("shrink-0 text-[12px]", on ? "text-ink-faint" : "text-bone")}>Critical</span> : null}
                </li>
              );
            })}
          </ul>
        </section>

        <p className="mt-9 max-w-xl text-[13px] leading-relaxed text-ink-faint">
          This page shows the truck as it stands right now. {job.company} loads out with SYNNR: the crew taps each piece onto the truck, and the truck reads Not ready until every one is on.
        </p>
      </main>

      <footer className="mx-auto w-full max-w-3xl border-t border-line px-4 py-6 text-[13px] text-ink-faint md:px-8">
        <Link href="/" className="underline-offset-4 transition-colors hover:text-ink hover:underline">SYNNR</Link>: tell it the job, it tells you what to take.
      </footer>
    </div>
  );
}
