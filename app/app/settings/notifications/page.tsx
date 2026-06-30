import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function saveSettings(formData: FormData) {
  "use server";
  const { company } = await requireCompany();
  const lead_days = Math.max(1, Math.min(120, parseInt(String(formData.get("lead_days") ?? "30"), 10) || 30));
  const email_enabled = formData.get("email_enabled") === "on";
  const recipients = String(formData.get("recipients") ?? "")
    .split(/[\n,]/).map((s) => s.trim()).filter((s) => /\S+@\S+\.\S+/.test(s));
  const db = await saasDb();
  const { error } = await db
    .from("saas_notification_settings")
    .upsert({ company_id: company.id, lead_days, email_enabled, recipients }, { onConflict: "company_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/app/settings/notifications");
}

export default async function NotificationsSettings() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const { data } = await db
    .from("saas_notification_settings")
    .select("lead_days, email_enabled, recipients").eq("company_id", company.id).maybeSingle();
  const s = (data as { lead_days: number; email_enabled: boolean; recipients: string[] } | null) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/app/settings" className="text-sm text-ink-dim hover:text-ink">← Settings</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-ink-dim">We watch every expiration. Tell us who to warn, and how early.</p>
      </div>

      <Card className="p-5">
        <form action={saveSettings} className="flex flex-col gap-5">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="email_enabled" defaultChecked={s?.email_enabled ?? true}
              className="h-4 w-4 accent-[#e7ddc7]" />
            Email alerts enabled
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink">Lead time (days before expiration)</span>
            <input name="lead_days" type="number" min={1} max={120} defaultValue={s?.lead_days ?? 30}
              className="h-11 w-32 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]" />
            <span className="text-xs text-ink-faint">We&apos;ll start warning this many days out.</span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink">Recipients</span>
            <textarea name="recipients" rows={3} defaultValue={(s?.recipients ?? []).join(", ")}
              placeholder="you@shop.com, dispatch@shop.com"
              className="rounded-lg border border-line-2 bg-surface px-3 py-2 text-ink outline-none focus:border-[#e7ddc7]" />
            <span className="text-xs text-ink-faint">Comma or line separated. Leave blank to alert the company owner.</span>
          </label>

          <div><Button type="submit">Save</Button></div>
        </form>
      </Card>
    </div>
  );
}
