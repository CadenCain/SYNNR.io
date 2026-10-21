import { notFound } from "next/navigation";
import Link from "next/link";
import { ScanLine } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getLoadout, outcomeOf } from "@/lib/saas/loadout-record";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import LoadoutRecordView from "../../_components/loadout-record-view";
import ProofLink from "../../_components/proof-link";
import { rollLoadoutAnyway } from "./actions";
import { recordPaper } from "@/lib/saas/paper";

export const dynamic = "force-dynamic";

/** One load-out record: the answer, the list, every scan with a name on it, and its proof link. */
export default async function LoadoutRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { company } = await requireCompany();
  const { id } = await params;
  const db = await saasDb();
  const got = await getLoadout(db, { id, companyId: company.id });
  if (!got) notFound();
  const { rec, override } = got;
  const outcome = outcomeOf(rec, override);
  const manager = company.role === "owner" || company.role === "admin";
  const proofUrl = `https://www.synnr.io/l/${rec.proof_token}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={rec.unit_id ? { href: `/app/units/${rec.unit_id}`, label: rec.unit_name } : { href: "/app/loadouts", label: "Load-outs" }}
        title={`${rec.unit_name} load-out`}
        description="The record of what went on the truck, who scanned each piece, and when."
      />

      <LoadoutRecordView rec={rec} override={override} paper={await recordPaper(db, company.id, rec.pieces)} />

      <Card className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="font-semibold">Proof link for the operator</h2>
          <p className="text-sm text-ink-dim">
            Anyone with this link sees this record, read-only.
            {outcome === "blocked" ? " Right now it says NOT READY, because it is." : ""}
          </p>
        </div>
        <ProofLink url={proofUrl} title={`${rec.unit_name} load-out`} />
      </Card>

      {outcome === "blocked" ? (
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-semibold">Fix it and scan again</h2>
          <p className="text-sm text-ink-dim">Swap the bad piece for a good one, find what&apos;s missing, or upload the new cert. Then run the load-out again.</p>
          {rec.unit_id ? (
            <Link href={`/app/units/${rec.unit_id}/scan`} className={buttonClass("default", "lg", "h-14 self-start text-base")}><ScanLine className="h-5 w-5" /> Scan {rec.unit_name} again</Link>
          ) : null}
          {manager ? (
            <details className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer text-sm font-semibold">Roll anyway (manager override)</summary>
              <form action={rollLoadoutAnyway} className="mt-3 flex flex-col gap-2">
                <input type="hidden" name="loadout_id" value={rec.id} />
                <label className="text-sm text-ink-dim" htmlFor="reason">Why is it OK to roll? Your name and this reason go on the record and the proof link, and anyone set up for alerts gets an email.</label>
                <textarea id="reason" name="reason" required minLength={10} maxLength={500} rows={3}
                  className="w-full rounded-lg border border-line-2 bg-coal px-3 py-2 text-ink outline-none focus:border-bone" />
                <button type="submit" className={buttonClass("outline", "lg", "self-start border-amber-500/50 text-amber-400")}>Roll it on my override</button>
              </form>
            </details>
          ) : (
            <p className="text-sm text-ink-faint">Only a manager can roll a NOT READY truck, and their name goes on the record.</p>
          )}
        </Card>
      ) : null}
    </div>
  );
}
