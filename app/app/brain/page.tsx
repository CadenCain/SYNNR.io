import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { isWritable } from "@/lib/saas/entitlements";
import { saasDb } from "@/lib/saas/db";
import { DOC_KINDS, type Doc } from "@/lib/saas/brain";
import { fmtWhen } from "@/lib/saas/format";
import AddDocs from "./add-docs";

export const metadata = { title: "The Brain" };
export const dynamic = "force-dynamic";

const DOC = "id, title, kind, origin, file_name, bytes, pages, status, problem, chars, managers_only, added_by_name, created_at";

/** How much reading a document is, in words a person uses: pages when it has them, otherwise roughly how long. */
function size(d: Doc): string {
  if (d.pages) return `${d.pages} ${d.pages === 1 ? "page" : "pages"}`;
  const words = Math.round(d.chars / 6 / 50) * 50;
  return words >= 100 ? `about ${words.toLocaleString("en-US")} words` : "a short one";
}

/**
 * What the brain holds: the shop's own documents, by kind, and its job
 * lists. A manager puts documents in and takes them out here. A hand sees
 * what's there to ask about, without the ones that are managers only (the
 * database leaves those out, so they aren't even counted).
 */
export default async function BrainPage() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const [{ data }, { count: jobLists }] = await Promise.all([
    db.from("synnr_docs").select(DOC).eq("company_id", company.id).order("title").limit(1000),
    db.from("saas_packages").select("id", { count: "exact", head: true }).eq("company_id", company.id).is("unit_id", null),
  ]);
  const docs = (data ?? []) as Doc[];
  const manager = company.role !== "member";
  const canAdd = manager && !company.is_demo && isWritable(company.subscription_status, company.comped);
  const ready = docs.filter((d) => d.status === "ready").length;
  const groups = DOC_KINDS.map((k) => ({ ...k, docs: docs.filter((d) => d.kind === k.id) })).filter((g) => g.docs.length);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-8 md:px-8 md:py-14">
      <div>
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink">The Brain</h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-dim">
          {company.is_demo
            ? "What the sample shop's brain holds. Every document here is made up, so you can see how it answers. In your own company, these are yours."
            : `What SYNNR knows about ${company.name}: the documents you put in, and your job lists. Every answer comes from these and nothing else.`}
        </p>
      </div>

      {canAdd ? <AddDocs /> : null}

      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[14px] font-medium text-ink">Documents</h2>
          {docs.length ? <span className="text-[13px] text-ink-faint">{ready} to answer from</span> : null}
        </div>
        {docs.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-line-2 px-6 py-8">
            <p className="text-[14px] font-medium text-ink">Nothing in here yet.</p>
            <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-ink-dim">
              {manager
                ? "Start with what the crew asks the office most: a procedure, a customer's MSA, the price sheet. Then the things nobody ever wrote down."
                : "Once your manager puts the shop's documents in, they show up here and you can ask about them."}
            </p>
          </div>
        ) : groups.map((g) => (
          <div key={g.id} className="mt-4">
            <div className="text-[13px] text-ink-faint">{g.label}</div>
            <ul className="mt-1.5 overflow-hidden rounded-xl border border-line">
              {g.docs.map((d) => (
                <li key={d.id} className="border-b border-line last:border-b-0">
                  <Link href={`/app/brain/docs/${d.id}`} className="group flex items-center gap-4 bg-surface px-4 py-3.5 transition-colors hover:bg-elevated sm:px-5">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[15px] text-ink">
                        <span className="truncate">{d.title}</span>
                        {d.managers_only ? <span className="flex shrink-0 items-center gap-1 rounded-full border border-line-2 px-2 py-0.5 text-[11px] text-ink-dim"><Lock className="h-3 w-3" /> Managers only</span> : null}
                      </span>
                      <span className={`mt-0.5 block text-[13px] leading-snug ${d.status === "failed" ? "text-red-300" : "text-ink-faint"}`}>
                        {d.status === "failed" ? `Couldn't be read. ${d.problem ?? ""}`
                          : d.status === "reading" ? "Didn't finish loading. Take it out and load it again."
                            : [size(d), d.origin === "note" ? "typed in" : null, d.added_by_name ? `${d.added_by_name}, ${fmtWhen(d.created_at)}` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-[14px] font-medium text-ink">Job lists</h2>
        <p className="mt-1 text-[13px] text-ink-dim">What your shop takes on each kind of job. Ask what goes out on a job, and the answer comes from these.</p>
        <Link href="/app/brain/lists" className="group mt-3 flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-5 py-4 transition-colors hover:bg-elevated">
          <span className="text-[15px] text-ink">{(jobLists ?? 0) === 0 ? (manager ? "Add your first job list" : "No job lists yet") : `${jobLists} ${jobLists === 1 ? "job list" : "job lists"}${manager ? ". Add or change them" : ""}`}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink" />
        </Link>
      </section>

      <section className="border-t border-line pt-6">
        <h2 className="text-[14px] font-medium text-ink">{company.is_demo ? "In your own company, they're yours" : "They're yours"}</h2>
        <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-dim">
          What you put in is only ever used to answer your own crew. It&apos;s never used for another company, and nobody outside your company can read it. Take a document out and nothing is answered from it again.
        </p>
        {manager && docs.length && !company.is_demo ? (
          <a href="/app/brain/export" className="mt-2 inline-flex min-h-9 items-center text-[13px] text-ink-dim underline underline-offset-4 hover:text-ink">Download everything it has read, in one file</a>
        ) : null}
      </section>
    </div>
  );
}
