import { revalidatePath } from "next/cache";
import { requireCompany, requireBillableCompany, assertCan } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getYardRules, isManagerRole } from "@/lib/saas/yard-rules";
import { logEvent } from "@/lib/saas/notify";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function saveRules(fd: FormData) {
  "use server";
  const { company, user } = await requireBillableCompany();
  assertCan(company, "set_rules");
  const db = await saasDb();
  const before = await getYardRules(db, company.id);
  const next = {
    hand_uploads_need_ok: fd.get("hand_uploads_need_ok") === "on",
    allow_cert_on_the_way: fd.get("allow_cert_on_the_way") === "on",
  };
  const { error } = await db.from("saas_enforcement_settings")
    .upsert({ company_id: company.id, ...next, updated_at: new Date().toISOString() }, { onConflict: "company_id" });
  if (error) throw new Error("Couldn't save the rules. Try again.");
  const changes: string[] = [];
  if (before.handUploadsNeedOk !== next.hand_uploads_need_ok) changes.push(next.hand_uploads_need_ok ? "every hand upload now waits for a manager" : "clean hand uploads now go green on their own");
  if (before.allowCertOnTheWay !== next.allow_cert_on_the_way) changes.push(next.allow_cert_on_the_way ? "\"cert on the way\" turned on" : "\"cert on the way\" turned off");
  if (changes.length) {
    const actor = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || null;
    void logEvent({ companyId: company.id, kind: "rules_changed", actor, message: `Rules changed${actor ? ` by ${actor}` : ""}: ${changes.join("; ")}` });
  }
  revalidatePath("/app/settings/rules");
}

const FIXED = [
  "Hands can't type or change a cert date. They upload a photo of the new cert.",
  "The server reads the photo. The expiration typed in has to be printed on it, the hand's name has to be on their card, the serial has to be on the gear's cert, and it has to be the right kind of cert. A photo can only clear one thing.",
  "If everything matches, it goes green. If anything doesn't, it waits for a manager and the item stays red until a manager approves it.",
  "Managers can type a date in, for setting up from the binder or fixing a typo. Those show \"date typed in, no photo\" and are listed on the Review page.",
  "Readiness check records, uploads, and the feed can't be edited or deleted by anyone, managers included.",
  "Only a manager can put red-tagged gear back in service, rename a hand or a cert, change a serial or unit number, mark a hand inactive, or delete anything. Each of those lands in the feed with a name on it.",
];

export default async function RulesPage() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const rules = await getYardRules(db, company.id);
  const manager = isManagerRole(company.role);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: "/app/settings", label: "Settings" }} title="Rules" description="How a cert gets cleared, and who can change what." />

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="font-semibold">Always on</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-ink-dim marker:text-ink-faint">
          {FIXED.map((r) => <li key={r}>{r}</li>)}
        </ol>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Manager switches</h2>
        {!manager && <p className="mt-1 text-sm text-ink-dim">A manager sets these.</p>}
        <form action={saveRules} className="mt-4 flex flex-col gap-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" name="hand_uploads_need_ok" defaultChecked={rules.handUploadsNeedOk} disabled={!manager}
              className="mt-1 h-5 w-5 shrink-0 accent-[#e7ddc7]" />
            <span>
              <span className="block text-sm font-medium">Every upload from a hand waits for a manager</span>
              <span className="block text-sm text-ink-dim">Off: a clean match goes green on its own, and anything that doesn&apos;t match waits for you. On: you OK every upload a hand sends, even clean ones.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" name="allow_cert_on_the_way" defaultChecked={rules.allowCertOnTheWay} disabled={!manager}
              className="mt-1 h-5 w-5 shrink-0 accent-[#e7ddc7]" />
            <span>
              <span className="block text-sm font-medium">Allow &quot;cert on the way&quot; after a retest</span>
              <span className="block text-sm text-ink-dim">A hand can upload the retest invoice or the new tag. Once a manager OKs it, the item shows yellow for 7 days and the truck can roll, then it goes red again unless the real cert is uploaded. Off: only the real cert clears it.</span>
            </span>
          </label>
          {manager && <Button type="submit" className="w-full sm:w-fit">Save the rules</Button>}
        </form>
      </Card>
    </div>
  );
}
