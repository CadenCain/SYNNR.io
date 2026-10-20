import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Check, ArrowRight } from "lucide-react";
import { requireCompany, requireBillableCompany, assertCan } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { billableYardCount } from "@/lib/saas/billing";
import { isBillableYard } from "@/lib/saas/billing-rules";
import { planLine } from "@/lib/saas/plan";
import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Getting set up · RollReady" };

/** Name every yard they paid for in one form (each still checked against the plan). */
async function nameYards(formData: FormData) {
  "use server";
  const { company } = await requireBillableCompany();
  assertCan(company, "create_yard");
  const names = formData.getAll("yard").map((v) => String(v).trim().slice(0, 80)).filter(Boolean);
  const db = await saasDb();
  let room = company.comped ? names.length : Math.max(0, company.yard_quantity - (await billableYardCount(company.id)));
  for (const name of names) {
    if (room <= 0) break;
    const { error } = await db.from("saas_yards").insert({ company_id: company.id, name });
    if (!error) room--;
  }
  revalidatePath("/app/welcome");
  redirect("/app/welcome");
}

/**
 * Right after paying: what to do first, checked off from the shop's own data
 * as they go. Yards, trucks, iron, kits, crew, tags, then the first load-out.
 * Free setup for the first 10 yards means Caden will load the list with
 * them, so "send us your list" is a real step, not a form to nowhere.
 */
export default async function Welcome() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const [{ data: yardRows }, { count: trucks }, { count: iron }, { count: kits }, { count: crew }, { count: tagged }, { count: loadouts }] = await Promise.all([
    db.from("saas_yards").select("id, name").eq("company_id", company.id).order("created_at"),
    db.from("saas_units").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    db.from("saas_assets").select("id", { count: "exact", head: true }).eq("company_id", company.id).neq("status", "retired"),
    db.from("saas_package_lines").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    db.from("saas_memberships").select("user_id", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "active"),
    db.from("saas_assets").select("id", { count: "exact", head: true }).eq("company_id", company.id).not("nfc_uid", "is", null),
    db.from("saas_loadout_scans").select("id", { count: "exact", head: true }).eq("company_id", company.id),
  ]);
  const yards = ((yardRows ?? []) as { id: string; name: string }[]).filter((y) => isBillableYard(y.name));
  const paidFor = company.comped ? yards.length : company.yard_quantity;
  const toName = Math.max(0, paidFor - yards.length);
  const manager = company.role === "owner" || company.role === "admin";

  const steps: { done: boolean; title: string; body: React.ReactNode; action?: React.ReactNode }[] = [
    {
      done: yards.length > 0 && toName === 0,
      title: toName ? `Name your ${paidFor === 1 ? "yard" : `${paidFor} yards`}` : "Your yards",
      body: yards.length ? <>Set up: {yards.map((y) => y.name).join(", ")}.</> : <>You&apos;re paying for {paidFor} {paidFor === 1 ? "yard" : "yards"}{company.comped ? "" : ` (${planLine(paidFor)})`}. Give each one the name your crew uses.</>,
      action: toName > 0 && manager ? (
        <form action={nameYards} className="flex flex-col gap-2">
          {Array.from({ length: toName }, (_, i) => (
            <input key={i} name="yard" required={i === 0} maxLength={80} placeholder={yards.length + i === 0 ? "Yard name, like Odessa Yard" : `Yard ${yards.length + i + 1} name`}
              className="h-12 w-full rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone" />
          ))}
          <button type="submit" className={buttonClass("default", "lg", "self-start")}>Save {toName === 1 ? "yard" : "yards"}</button>
        </form>
      ) : null,
    },
    {
      done: (trucks ?? 0) > 0,
      title: "Add your trucks and trailers",
      body: <>Every truck that gets loaded out: coil units, pump trucks, trailers.{trucks ? ` ${trucks} so far.` : ""}</>,
      action: <Link href={yards[0] ? `/app/yards/${yards[0].id}` : "/app/yards"} className={buttonClass("outline", "lg")}>Add trucks <ArrowRight className="h-4 w-4" /></Link>,
    },
    {
      done: (iron ?? 0) > 0,
      title: "Load your iron",
      body: <>Every piece with its serial, which truck it&apos;s on, and its test dates. Fastest is your spreadsheet or the testing company&apos;s list. {iron ? `${iron} pieces so far.` : ""}</>,
      action: (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {manager ? <Link href="/app/import" className={buttonClass("default", "lg")}>Upload a spreadsheet</Link> : null}
            <Link href="/app/equipment" className={buttonClass("outline", "lg")}>Add pieces by hand</Link>
          </div>
          <p className="text-sm text-ink-dim">
            Rather hand it off? Email the list in any format to cadencain@synnr.io, or call or text Caden at <a href={OWNER_PHONE_TEL} className="text-bone underline underline-offset-2">{OWNER_PHONE}</a>. Setup is free for the first 10 yards, and he&apos;ll load it with you.
          </p>
        </div>
      ),
    },
    {
      done: (kits ?? 0) > 0,
      title: "Set each truck's kit",
      body: <>What every truck always leaves with. One tap makes them from what&apos;s logged on each truck, then you fix anything that&apos;s off. Add packages for kinds of jobs too.</>,
      action: <Link href="/app/packages" className={buttonClass("outline", "lg")}>Packages &amp; kits <ArrowRight className="h-4 w-4" /></Link>,
    },
    {
      done: (crew ?? 0) > 1,
      title: "Invite your crew",
      body: <>Each hand gets their own login, so every scan has their name on it. Your whole crew is included. Never per-seat.</>,
      action: manager ? <Link href="/app/settings/team" className={buttonClass("outline", "lg")}>Invite people <ArrowRight className="h-4 w-4" /></Link> : null,
    },
    {
      done: (tagged ?? 0) > 0,
      title: "Tag the iron",
      body: <>Link the NFC tags your testing company already put on (tap one at load-out and pick the piece), or print RollReady QR tags for any phone.</>,
      action: <Link href="/app/tags" className={buttonClass("outline", "lg")}>QR tags <ArrowRight className="h-4 w-4" /></Link>,
    },
    {
      done: (loadouts ?? 0) > 0,
      title: "Run your first load-out",
      body: <>Pick a truck, scan each piece as it goes on, hit Done. You get READY or NOT READY and a proof link for the operator.</>,
      action: <Link href="/app" className={buttonClass("default", "lg")}>Go to Load out <ArrowRight className="h-4 w-4" /></Link>,
    },
  ];
  const done = steps.filter((s) => s.done).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">Welcome to RollReady</h1>
        <p className="mt-1 text-sm text-ink-dim">
          {company.subscription_status === "active" ? "You're paid up and in. " : ""}Here&apos;s the fastest way to your first load-out. {done} of {steps.length} done.
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Card className={cn("flex gap-4 p-4", s.done && "border-emerald-500/40")}>
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                s.done ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400" : "border-line-2 text-ink-dim")}>
                {s.done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <h2 className="font-semibold">{s.title}</h2>
                <div className="text-sm text-ink-dim">{s.body}</div>
                {!s.done || i === 0 ? s.action : null}
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
