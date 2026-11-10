import Link from "next/link";
import { FileText } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";

export const metadata = { title: "The Brain" };
export const dynamic = "force-dynamic";

type Known = { label: string; n: number; from: string; href?: string };

/**
 * What SYNNR knows about this company, in plain counts, and what it still
 * needs. Everything already in the account counts. The documents that make
 * it worth asking (the price book, MSAs, procedures, signed tickets) load
 * here next.
 */
export default async function BrainPage() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const head = { count: "exact" as const, head: true };

  const [people, yards, trucks, iron, tools, truckLists, jobLists] = await Promise.all([
    count(db.from("saas_memberships").select("user_id", head).eq("company_id", company.id).eq("status", "active")),
    count(db.from("saas_yards").select("id", head).eq("company_id", company.id)),
    count(db.from("saas_units").select("id", head).eq("company_id", company.id)),
    count(db.from("saas_assets").select("id", head).eq("company_id", company.id).neq("status", "retired")),
    count(db.from("saas_tool_stocks").select("id", head).eq("company_id", company.id).is("archived_at", null)),
    count(db.from("saas_packages").select("id", head).eq("company_id", company.id).not("unit_id", "is", null)),
    count(db.from("saas_packages").select("id", head).eq("company_id", company.id).is("unit_id", null)),
  ]);

  const known: Known[] = [
    { label: "People", n: people, from: "Your team", href: "/app/settings/team" },
    { label: "Yards", n: yards, from: "Your account" },
    { label: "Trucks", n: trucks, from: "Your account" },
    { label: "Iron and tools", n: iron + tools, from: "Your account" },
    { label: "Truck lists", n: truckLists, from: "What goes on each truck" },
    { label: "Job lists", n: jobLists, from: "What each kind of job takes" },
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
          Everything SYNNR knows about {company.name}. It answers from this and nothing else, so the more you give it, the more it can answer.
        </p>
      </div>

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
        <h2 className="text-[14px] font-medium text-ink">What it needs from you</h2>
        <p className="mt-1 text-[13px] text-ink-dim">This is what lets it tell you what to charge, what to take, and how your shop does it.</p>
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          {needs.map((d) => (
            <div key={d.label} className="flex items-start gap-4 border-b border-line bg-surface px-5 py-4 last:border-b-0">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] text-ink">{d.label}</div>
                <div className="mt-0.5 text-[13px] leading-relaxed text-ink-dim">{d.what}</div>
              </div>
              <span className="mt-0.5 shrink-0 text-[12px] text-ink-faint">Not loaded</span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-line-2 px-6 py-8 text-center">
          <p className="text-[14px] font-medium text-ink">Uploading opens in the next build</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-ink-dim">
            PDFs, spreadsheets, Word files, and phone photos of paper. Get yours together now, with anything private blacked out.
          </p>
        </div>
      </section>
    </div>
  );
}
