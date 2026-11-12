import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { isWritable } from "@/lib/saas/entitlements";
import { saasDb } from "@/lib/saas/db";
import { createList } from "./actions";

export const metadata = { title: "Job lists" };
export const dynamic = "force-dynamic";

/** Every kind of job the shop runs, and how many pieces SYNNR knows it takes. */
export default async function JobLists({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const { company } = await requireCompany();
  const { err } = await searchParams;
  const db = await saasDb();
  const { data } = await db.from("saas_packages").select("id, name, saas_package_lines(critical, phase)").eq("company_id", company.id).is("unit_id", null).order("name").limit(200);
  const lists = (data ?? []) as { id: string; name: string; saas_package_lines: { critical: boolean; phase: string }[] | null }[];
  const canEdit = company.role !== "member" && isWritable(company.subscription_status, company.comped);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
      <div>
        <Link href="/app/brain" className="inline-flex min-h-9 items-center gap-1 text-[13px] text-ink-faint transition-colors hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> The Brain
        </Link>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink">Job lists</h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-dim">
          What your shop takes on each kind of job. When a job comes in, SYNNR builds the checklist from the matching list, then adds anything the dispatch calls out.
        </p>
      </div>

      {err ? <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err.slice(0, 200)}</p> : null}

      {lists.length ? (
        <div className="overflow-hidden rounded-xl border border-line">
          {lists.map((l) => {
            const pieces = (l.saas_package_lines ?? []).filter((x) => x.phase !== "after");
            const after = (l.saas_package_lines?.length ?? 0) - pieces.length;
            const n = pieces.length;
            const crit = pieces.filter((x) => x.critical).length;
            return (
              <Link key={l.id} href={`/app/brain/lists/${l.id}`} className="group flex items-center gap-4 border-b border-line bg-surface px-5 py-4 transition-colors last:border-b-0 hover:bg-elevated">
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] text-ink">{l.name}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-dim">{n === 0 && !after ? "Nothing on it yet" : `${n} ${n === 1 ? "piece" : "pieces"}${crit ? `, ${crit} critical` : ""}${after ? `, ${after} after the job` : ""}`}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink" />
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-line bg-surface px-5 py-6 text-[15px] leading-relaxed text-ink-dim">
          No job lists yet. Start with the jobs you run most, like pipe recovery, plug and cement, or setting a packer.
        </p>
      )}

      {canEdit ? (
        <form action={createList} className="flex flex-col gap-3 sm:flex-row">
          <input name="name" required maxLength={80} placeholder="A kind of job, like Pipe recovery" aria-label="Kind of job"
            className="h-12 min-w-0 flex-1 rounded-lg border border-line-2 bg-coal px-3.5 text-[16px] text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint" />
          <button type="submit" className="h-12 rounded-lg bg-ink px-5 text-[15px] font-medium text-coal transition-colors hover:bg-white">Add a job list</button>
        </form>
      ) : (
        <p className="text-[13px] text-ink-faint">Only a manager can change the job lists.</p>
      )}
    </div>
  );
}
