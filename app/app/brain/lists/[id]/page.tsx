import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { isWritable } from "@/lib/saas/entitlements";
import { saasDb } from "@/lib/saas/db";
import { afterLines, loadLines, MAX_LINES, orderLines, type Phase } from "@/lib/saas/jobs";
import { addListLine, deleteList, removeListLine, renameList, setLineCritical } from "../actions";

export const metadata = { title: "Job list" };
export const dynamic = "force-dynamic";

const field = "h-12 rounded-lg border border-line-2 bg-coal px-3.5 text-[16px] text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint";

/** One kind of job: the pieces it takes, which ones stop the job if they're missing, and what the crew proves when it's done. */
export default async function JobList({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string }> }) {
  const { company } = await requireCompany();
  const { id } = await params;
  const { err } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await saasDb();
  const [{ data: list }, { data: lineRows }] = await Promise.all([
    db.from("saas_packages").select("id, name").eq("id", id).eq("company_id", company.id).is("unit_id", null).maybeSingle(),
    db.from("saas_package_lines").select("id, label, qty, critical, phase, sort").eq("package_id", id).eq("company_id", company.id).order("sort").limit(MAX_LINES),
  ]);
  if (!list) notFound();
  const l = list as { id: string; name: string };
  const all = (lineRows ?? []) as { id: string; label: string; qty: number; critical: boolean; phase: Phase; sort: number }[];
  const lines = orderLines(loadLines(all));
  const after = afterLines(all).sort((a, b) => a.sort - b.sort);
  const canEdit = company.role !== "member" && isWritable(company.subscription_status, company.comped);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
      <div>
        <Link href="/app/brain/lists" className="inline-flex min-h-9 items-center gap-1 text-[13px] text-ink-faint transition-colors hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> Job lists
        </Link>
        <h1 className="mt-2 break-words text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink">{l.name}</h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-dim">What goes on the truck for this job. Mark the pieces that stop the job if they&apos;re forgotten, and they go to the top of every checklist.</p>
      </div>

      {err ? <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err.slice(0, 200)}</p> : null}

      <ul className="overflow-hidden rounded-xl border border-line">
        {lines.length === 0 ? <li className="bg-surface px-5 py-6 text-[15px] text-ink-dim">Nothing on this list yet.</li> : lines.map((x) => (
          <li key={x.id} className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5 last:border-b-0 sm:px-5">
            <span className="min-w-0 flex-1 text-[16px] text-ink">{x.label}{x.qty > 1 ? <span className="text-ink-faint"> × {x.qty}</span> : null}</span>
            {canEdit ? (
              <>
                <form action={setLineCritical}>
                  <input type="hidden" name="id" value={l.id} /><input type="hidden" name="line" value={x.id} /><input type="hidden" name="critical" value={x.critical ? "0" : "1"} />
                  <button type="submit" aria-pressed={x.critical}
                    className={`h-9 rounded-full border px-3 text-[12px] transition-colors ${x.critical ? "border-bone text-bone hover:bg-bone/10" : "border-line-2 text-ink-faint hover:text-ink"}`}>
                    {x.critical ? "Critical" : "Mark critical"}
                  </button>
                </form>
                <form action={removeListLine}>
                  <input type="hidden" name="id" value={l.id} /><input type="hidden" name="line" value={x.id} />
                  <button type="submit" aria-label={`Take ${x.label} off the list`} className="flex h-9 w-9 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-elevated hover:text-red-400"><X className="h-4 w-4" /></button>
                </form>
              </>
            ) : x.critical ? <span className="text-[12px] text-bone">Critical</span> : null}
          </li>
        ))}
      </ul>

      {canEdit ? (
        <form action={addListLine} className="flex flex-col gap-3 rounded-xl border border-line-2 bg-surface p-4 sm:flex-row sm:items-center">
          <input type="hidden" name="id" value={l.id} />
          <input name="label" required maxLength={120} placeholder="A piece, like Free point tool" aria-label="Piece" className={`${field} min-w-0 flex-1`} />
          <input name="qty" type="number" min={1} max={999} defaultValue={1} aria-label="How many" className={`${field} w-20`} />
          <label className="flex h-12 items-center gap-2 text-[14px] text-ink-dim"><input name="critical" type="checkbox" className="h-5 w-5 accent-bone" /> Critical</label>
          <button type="submit" className="h-12 rounded-lg bg-ink px-5 text-[15px] font-medium text-coal transition-colors hover:bg-white">Add</button>
        </form>
      ) : null}

      {/* After the job: what the crew proves before anyone goes home */}
      <section className="mt-3 flex flex-col gap-3">
        <div>
          <h2 className="text-[17px] font-medium text-ink">After the job</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-dim">
            What the crew proves when the job is done, like BOP rams closed for travel or the package washed. Each one takes a photo, so you see it was done without going to look. These don&apos;t hold a truck back from Ready.
          </p>
        </div>
        <ul className="overflow-hidden rounded-xl border border-line">
          {after.length === 0 ? <li className="bg-surface px-5 py-6 text-[15px] text-ink-dim">Nothing to prove after this job yet.</li> : after.map((x) => (
            <li key={x.id} className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5 last:border-b-0 sm:px-5">
              <span className="min-w-0 flex-1 text-[16px] text-ink">{x.label}</span>
              <span className="shrink-0 text-[12px] text-ink-faint">Photo</span>
              {canEdit ? (
                <form action={removeListLine}>
                  <input type="hidden" name="id" value={l.id} /><input type="hidden" name="line" value={x.id} />
                  <button type="submit" aria-label={`Take ${x.label} off the list`} className="flex h-9 w-9 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-elevated hover:text-red-400"><X className="h-4 w-4" /></button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <form action={addListLine} className="flex flex-col gap-3 rounded-xl border border-line-2 bg-surface p-4 sm:flex-row sm:items-center">
            <input type="hidden" name="id" value={l.id} /><input type="hidden" name="phase" value="after" />
            <input name="label" required maxLength={120} placeholder="Something to prove, like BOP rams closed for travel" aria-label="Something to prove after the job" className={`${field} min-w-0 flex-1`} />
            <button type="submit" className="h-12 rounded-lg bg-ink px-5 text-[15px] font-medium text-coal transition-colors hover:bg-white">Add</button>
          </form>
        ) : null}
      </section>

      {canEdit ? (
        <>
          <details className="rounded-xl border border-line">
            <summary className="cursor-pointer list-none px-5 py-3.5 text-[14px] text-ink-dim transition-colors hover:text-ink">Rename or delete this list</summary>
            <div className="flex flex-col gap-4 border-t border-line px-5 py-4">
              <form action={renameList} className="flex flex-col gap-3 sm:flex-row">
                <input type="hidden" name="id" value={l.id} />
                <input name="name" required maxLength={80} defaultValue={l.name} aria-label="Name" className={`${field} min-w-0 flex-1`} />
                <button type="submit" className="h-12 rounded-lg border border-line-2 px-5 text-[15px] text-ink transition-colors hover:bg-elevated">Rename</button>
              </form>
              <form action={deleteList} className="flex flex-col gap-3 border-t border-line pt-4">
                <input type="hidden" name="id" value={l.id} />
                <label className="flex items-center gap-2 text-[14px] text-ink-dim"><input type="checkbox" required className="h-5 w-5 accent-red-500" /> Delete the {l.name} list. Jobs already started keep their own checklists.</label>
                <button type="submit" className="h-11 self-start rounded-lg border border-red-500/40 px-4 text-[14px] text-red-400 transition-colors hover:bg-red-500/10">Delete list</button>
              </form>
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}
