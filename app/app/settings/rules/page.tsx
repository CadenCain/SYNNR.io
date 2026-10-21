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
  const days = Math.min(90, Math.max(1, Math.floor(Number(fd.get("out_alert_days"))) || before.outAlertDays));
  const next = {
    hand_uploads_need_ok: fd.get("hand_uploads_need_ok") === "on",
    allow_cert_on_the_way: fd.get("allow_cert_on_the_way") === "on",
    out_alert_days: days,
  };
  const { error } = await db.from("saas_enforcement_settings")
    .upsert({ company_id: company.id, ...next, updated_at: new Date().toISOString() }, { onConflict: "company_id" });
  if (error) throw new Error("Couldn't save the rules. Try again.");
  const changes: string[] = [];
  if (before.handUploadsNeedOk !== next.hand_uploads_need_ok) changes.push(next.hand_uploads_need_ok ? "every hand upload now waits for a manager" : "clean hand uploads now go green on their own");
  if (before.allowCertOnTheWay !== next.allow_cert_on_the_way) changes.push(next.allow_cert_on_the_way ? "\"cert on the way\" turned on" : "\"cert on the way\" turned off");
  if (before.outAlertDays !== next.out_alert_days) changes.push(`iron out more than ${next.out_alert_days} days gets flagged`);
  if (changes.length) {
    const actor = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || null;
    void logEvent({ companyId: company.id, kind: "rules_changed", actor, message: `Rules changed${actor ? ` by ${actor}` : ""}: ${changes.join("; ")}` });
  }
  revalidatePath("/app/settings/rules");
}

const FIXED = [
  "Hands can't type or change a test date. They upload a photo of the new cert.",
  "The server reads the photo. The expiration typed in has to be printed on it, the serial on the cert has to match the iron, and it has to be the right kind of test. A photo can only clear one thing.",
  "If everything matches, it goes green. If anything doesn't, it waits for a manager and the item stays red until a manager approves it.",
  "Managers can type a date in when setting up from the binder. A typed date that's later than what's on file doesn't count until a photo of the cert shows it. Typed dates are listed on the Review page.",
  "Truck check records, uploads, where-it's-been history, and the feed can't be edited or deleted by anyone, managers included.",
  "Anyone can move iron or red-tag it. Only a manager can put red-tagged iron back in service, retire it, rename a test, change a serial or unit number, or delete anything. Each of those lands in the feed with a name on it.",
];

export default async function RulesPage() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const rules = await getYardRules(db, company.id);
  const manager = isManagerRole(company.role);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: "/app/settings", label: "Settings" }} title="Rules" description="How a test gets cleared, and who can change what." />

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
              className="mt-1 h-5 w-5 shrink-0 accent-[#1d4ed8]" />
            <span>
              <span className="block text-sm font-medium">Every upload from a hand waits for a manager</span>
              <span className="block text-sm text-ink-dim">Off: a clean match goes green on its own, and anything that doesn&apos;t match waits for you. On: you OK every upload a hand sends, even clean ones.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" name="allow_cert_on_the_way" defaultChecked={rules.allowCertOnTheWay} disabled={!manager}
              className="mt-1 h-5 w-5 shrink-0 accent-[#1d4ed8]" />
            <span>
              <span className="block text-sm font-medium">Allow &quot;cert on the way&quot; after a retest</span>
              <span className="block text-sm text-ink-dim">A hand can upload the retest invoice or the new tag. Once a manager OKs it, the item shows yellow for 7 days and the truck can roll, then it goes red again unless the real cert is uploaded. Off: only the real cert clears it.</span>
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="block text-sm font-medium">Flag iron that&apos;s been out on a job longer than</span>
            <span className="flex items-center gap-2">
              <input type="number" name="out_alert_days" min={1} max={90} defaultValue={rules.outAlertDays} disabled={!manager}
                className="h-12 w-24 rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone" />
              <span className="text-sm text-ink-dim">days</span>
            </span>
            <span className="block text-sm text-ink-dim">Past this, a truck or piece that hasn&apos;t been checked back in shows red on Load out, and managers get one email a day listing what&apos;s new. Not one email per piece.</span>
          </label>
          {manager && <Button type="submit" className="w-full sm:w-fit">Save the rules</Button>}
        </form>
      </Card>
    </div>
  );
}
