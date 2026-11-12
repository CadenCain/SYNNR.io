import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";

export const metadata = { title: "The Brain" };
export const dynamic = "force-dynamic";

type Known = { label: string; n: number; from: string; href?: string };

/**
 * What SYNNR knows about this company, in plain counts: the people, the job
 * lists, the jobs it has run and the photos it keeps. Then the documents it
 * will take later (the price book, MSAs, procedures, signed tickets), which
 * there's no way to load yet, and the page says so.
 */
export default async function BrainPage() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const head = { count: "exact" as const, head: true };

  const [people, jobLists, jobs, photos] = await Promise.all([
    count(db.from("saas_memberships").select("user_id", head).eq("company_id", company.id).eq("status", "active")),
    count(db.from("saas_packages").select("id", head).eq("company_id", company.id).is("unit_id", null)),
    count(db.from("synnr_jobs").select("id", head).eq("company_id", company.id)),
    count(db.from("synnr_job_lines").select("id", head).eq("company_id", company.id).not("photo_path", "is", null)),
  ]);

  const known: Known[] = [
    { label: "People", n: people, from: "Your team", href: "/app/settings/team" },
    { label: "Job lists", n: jobLists, from: "What each kind of job takes", href: "/app/brain/lists" },
    { label: "Jobs", n: jobs, from: "Every job your crews have run", href: "/app" },
    { label: "Proof photos", n: photos, from: "Kept with the job they prove" },
  ];

  const needs = [
    { label: "Price book", what: "What you charge for every job, run, and line item." },
    { label: "MSAs", what: "Each customer's terms, rates, and what they require on location." },
    { label: "Procedures", what: "How your crews rig up, run, and rig down, the way your shop does it." },
    { label: "Signed tickets", what: "What actually got run and billed, job by job." },
    { label: "Job sheets", what: "Perf run sheets, checklists, and the forms your crews already use." },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-4 py-8 md:px-8 md:py-14">
      <div>
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink">The Brain</h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-dim">
          What SYNNR knows about {company.name}. Today that&apos;s your job lists, the jobs your crews run, and the photos that prove them.
        </p>
      </div>

      <section>
        <h2 className="text-[14px] font-medium text-ink">Job lists</h2>
        <p className="mt-1 text-[13px] text-ink-dim">What your shop takes on each kind of job. Every checklist is built from these.</p>
        <Link href="/app/brain/lists" className="group mt-3 flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-5 py-4 transition-colors hover:bg-elevated">
          <span className="text-[15px] text-ink">{jobLists === 0 ? "Add your first job list" : `${jobLists} ${jobLists === 1 ? "job list" : "job lists"}. Add or change them`}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink" />
        </Link>
      </section>

      <section>
        <h2 className="text-[14px] font-medium text-ink">What it knows</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          {known.map((k) => {
            const row = (
              <>
                <span className="w-16 shrink-0 font-mono text-[15px] tabular-nums text-ink">{k.n.toLocaleString("en-US")}</span>
                <span className="min-w-0 flex-1 text-[14px] text-ink">{k.label}</span>
                <span className="hidden shrink-0 text-[13px] text-ink-faint sm:block">{k.from}</span>
              </>
            );
            const cls = "flex items-center gap-4 border-b border-line bg-surface px-5 py-3.5 last:border-b-0";
            return k.href
              ? <Link key={k.label} href={k.href} className={`${cls} transition-colors hover:bg-elevated`}>{row}</Link>
              : <div key={k.label} className={cls}>{row}</div>;
          })}
        </div>
      </section>

      <section>
        <h2 className="text-[14px] font-medium text-ink">What it will take next</h2>
        <p className="mt-1 text-[13px] text-ink-dim">This is what will let it tell you what to charge and how your shop does it. There&apos;s no way to load these yet.</p>
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          {needs.map((d) => (
            <div key={d.label} className="flex items-start gap-4 border-b border-line bg-surface px-5 py-4 last:border-b-0">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] text-ink">{d.label}</div>
                <div className="mt-0.5 text-[13px] leading-relaxed text-ink-dim">{d.what}</div>
              </div>
              <span className="mt-0.5 shrink-0 text-[12px] text-ink-faint">Not yet</span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-line-2 px-6 py-8 text-center">
          <p className="text-[14px] font-medium text-ink">Uploading isn&apos;t open yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-ink-dim">
            When it is: PDFs, spreadsheets, Word files, and phone photos of paper, with anything private blacked out.
          </p>
        </div>
      </section>
    </div>
  );
}
