import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Plus, Trash2, MessageSquareText, Mail } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { smsConfigured } from "@/lib/saas/notify";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const fld = "h-11 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]";

async function saveSettings(formData: FormData) {
  "use server";
  const { company } = await requireCompany();
  const lead_days = Math.max(1, Math.min(120, parseInt(String(formData.get("lead_days") ?? "30"), 10) || 30));
  const email_enabled = formData.get("email_enabled") === "on";
  const db = await saasDb();
  const { error } = await db
    .from("saas_notification_settings")
    .upsert({ company_id: company.id, lead_days, email_enabled }, { onConflict: "company_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/app/settings/notifications");
}

async function addRecipient(formData: FormData) {
  "use server";
  const { company } = await requireCompany();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  let phone = String(formData.get("phone") ?? "").replace(/[^\d+]/g, "") || null;
  if (phone && !phone.startsWith("+")) phone = `+1${phone}`; // default US E.164
  const yard_id = String(formData.get("yard_id") ?? "");
  const channels: string[] = [];
  if (formData.get("ch_email") === "on" && email) channels.push("email");
  if (formData.get("ch_sms") === "on" && phone) channels.push("sms");
  if (!name || (!email && !phone) || channels.length === 0) return;
  const db = await saasDb();
  await db.from("saas_alert_recipients").insert({
    company_id: company.id, name, email, phone, channels,
    yard_ids: yard_id ? [yard_id] : null,
  });
  revalidatePath("/app/settings/notifications");
}

async function removeRecipient(formData: FormData) {
  "use server";
  const { company } = await requireCompany();
  const id = String(formData.get("id") ?? "");
  const db = await saasDb();
  await db.from("saas_alert_recipients").delete().eq("id", id).eq("company_id", company.id);
  revalidatePath("/app/settings/notifications");
}

export default async function NotificationsSettings() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const [{ data }, { data: recipData }, { data: yardData }] = await Promise.all([
    db.from("saas_notification_settings").select("lead_days, email_enabled").eq("company_id", company.id).maybeSingle(),
    db.from("saas_alert_recipients").select("id, name, email, phone, channels, yard_ids").eq("company_id", company.id).order("created_at"),
    db.from("saas_yards").select("id, name").eq("company_id", company.id).order("name"),
  ]);
  const s = (data as { lead_days: number; email_enabled: boolean } | null) ?? null;
  const recips = (recipData ?? []) as { id: string; name: string; email: string | null; phone: string | null; channels: string[]; yard_ids: string[] | null }[];
  const yards = (yardData ?? []) as { id: string; name: string }[];
  const yardName = new Map(yards.map((y) => [y.id, y.name]));
  const smsReady = smsConfigured();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/app/settings" className="text-sm text-ink-dim hover:text-ink">← Settings</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-ink-dim">We watch every expiration and every roll-out. Tell us who gets the heads-up, and how early.</p>
      </div>

      <Card className="p-5">
        <form action={saveSettings} className="flex flex-col gap-5">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="email_enabled" defaultChecked={s?.email_enabled ?? true} className="h-4 w-4 accent-[#e7ddc7]" />
            Alerts enabled
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink">Lead time (days before expiration)</span>
            <input name="lead_days" type="number" min={1} max={120} defaultValue={s?.lead_days ?? 30} className={`${fld} w-32`} />
            <span className="text-xs text-ink-faint">We&apos;ll start warning this many days out.</span>
          </label>
          <div><Button type="submit">Save</Button></div>
        </form>
      </Card>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold">Who gets the alerts</h2>
          <p className="mt-0.5 text-sm text-ink-dim">
            Expiring certs &amp; crew cards, NOT-ready overrides, and gear that didn&apos;t come back.
            {!smsReady && " Text alerts activate once SMS credentials are connected — email works now."}
          </p>
        </div>

        {recips.length > 0 && (
          <div className="flex flex-col gap-2">
            {recips.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="truncate text-sm text-ink-dim">
                    {[r.email, r.phone].filter(Boolean).join(" · ")}
                    {" — "}{r.yard_ids === null ? "all yards" : (r.yard_ids.map((y) => yardName.get(y) ?? "yard").join(", "))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {r.channels.includes("email") && <span className="flex items-center gap-1 rounded-sm border border-line-2 px-2 py-0.5 text-xs text-ink-dim"><Mail className="h-3 w-3" /> email</span>}
                  {r.channels.includes("sms") && <span className="flex items-center gap-1 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400"><MessageSquareText className="h-3 w-3" /> text</span>}
                </div>
                <form action={removeRecipient}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" title="Remove" className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-faint hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </Card>
            ))}
          </div>
        )}

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-medium text-ink">{recips.length ? "Add another person" : "Add your first recipient — e.g. the foreman who rolls the trucks"}</h3>
          <form action={addRecipient} className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input name="name" required placeholder="Name" className={`${fld} flex-1`} />
              <input name="email" type="email" placeholder="Email (optional)" className={`${fld} flex-1`} />
              <input name="phone" type="tel" placeholder="Cell for texts (optional)" className={`${fld} flex-1`} />
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ch_email" defaultChecked className="h-4 w-4 accent-[#e7ddc7]" /> Email</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ch_sms" className="h-4 w-4 accent-[#e7ddc7]" /> Text (SMS)</label>
              {yards.length > 0 && (
                <select name="yard_id" defaultValue="" className={`${fld} sm:w-52`}>
                  <option value="">All yards</option>
                  {yards.map((y) => <option key={y.id} value={y.id}>Only {y.name}</option>)}
                </select>
              )}
              <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Add</Button>
            </div>
          </form>
        </Card>
      </section>
    </div>
  );
}
