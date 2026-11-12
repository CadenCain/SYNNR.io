import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { aiReady } from "@/lib/saas/read-dispatch";
import NewJob from "./new-job";

export const metadata = { title: "New job" };
export const dynamic = "force-dynamic";

/** Start a job from the dispatch, or type it in. */
export default async function NewJobPage() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const [{ data: lists }, { data: recent }] = await Promise.all([
    db.from("saas_packages").select("id, name, saas_package_lines(phase)").eq("company_id", company.id).is("unit_id", null).order("name").limit(200),
    // Truck names to pick from: the ones this shop has already sent out, newest first.
    db.from("synnr_jobs").select("truck").eq("company_id", company.id).not("truck", "is", null).order("created_at", { ascending: false }).limit(200),
  ]);
  const trucks = [...new Set(((recent ?? []) as { truck: string | null }[]).map((j) => (j.truck ?? "").trim()).filter(Boolean))].slice(0, 40);
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <Link href="/app" className="inline-flex min-h-9 items-center gap-1 text-[13px] text-ink-faint transition-colors hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> Jobs
      </Link>
      <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink md:text-[34px]">New job</h1>
      <p className="mt-1.5 text-[15px] text-ink-dim">Tell SYNNR the job. It builds what to take.</p>
      <div className="mt-7">
        <NewJob ai={aiReady() && !company.is_demo}
          lists={((lists ?? []) as { id: string; name: string; saas_package_lines: { phase: string }[] | null }[]).map((l) => {
            // Pieces that go on the truck, and what the crew proves after the job, are counted apart.
            const after = (l.saas_package_lines ?? []).filter((x) => x.phase === "after").length;
            return { id: l.id, name: l.name, count: (l.saas_package_lines?.length ?? 0) - after, after };
          })}
          trucks={trucks} />
      </div>
    </div>
  );
}
