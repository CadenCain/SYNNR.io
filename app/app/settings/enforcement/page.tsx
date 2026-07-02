import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/**
 * Check-out enforcement (walkthrough C4) — how much proof a rollout demands.
 * The dispatch record itself is append-only regardless: who checked, what was
 * confirmed, photos, overrides, co-signer. These toggles add friction where
 * the shop wants it.
 */
async function saveEnforcement(formData: FormData) {
  "use server";
  const { company } = await requireCompany();
  const photo_mode = ["off", "flagged", "all"].includes(String(formData.get("photo_mode")))
    ? String(formData.get("photo_mode")) : "flagged";
  const require_cosign = formData.get("cosign") === "on";
  const require_pin = formData.get("pin_required") === "on";
  const pin = String(formData.get("pin") ?? "").trim();
  const db = await saasDb();
  const patch: Record<string, unknown> = {
    company_id: company.id,
    photo_mode,
    require_cosign,
    require_pin,
    updated_at: new Date().toISOString(),
  };
  if (pin) patch.cosign_pin = pin; // blank keeps the existing PIN
  const { error } = await db.from("saas_enforcement_settings").upsert(patch, { onConflict: "company_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/app/settings/enforcement");
}

export default async function EnforcementSettings() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const { data } = await db
    .from("saas_enforcement_settings")
    .select("photo_mode, require_pin, require_cosign, cosign_pin")
    .eq("company_id", company.id).maybeSingle();
  const s = data as { photo_mode: string; require_pin: boolean; require_cosign: boolean; cosign_pin: string | null } | null;
  const isAdmin = company.role === "owner" || company.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/app/settings" className="text-sm text-ink-dim hover:text-ink">← Settings</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Check-out enforcement</h1>
        <p className="mt-1 text-sm text-ink-dim">
          Every dispatch record already captures who checked, what was confirmed, and any override — and can&apos;t be edited after the fact. These add extra proof at rollout.
        </p>
      </div>

      {!isAdmin ? (
        <Card className="px-6 py-12 text-center text-sm text-ink-dim">Enforcement rules are admin-only.</Card>
      ) : (
        <Card className="p-5">
          <form action={saveEnforcement} className="flex flex-col gap-5">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink">Photo proof</span>
              <select name="photo_mode" defaultValue={s?.photo_mode ?? "flagged"}
                className="h-11 w-full max-w-md rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]">
                <option value="off">Off — photos optional</option>
                <option value="flagged">On flagged items — anything marked Missing needs a photo</option>
                <option value="all">Required on every line — photo per item, every check-out</option>
              </select>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="pin_required" defaultChecked={s?.require_pin ?? true} className="mt-0.5 h-4 w-4 accent-[#e7ddc7]" />
              <span>
                <span className="block font-medium text-ink">Require checker name + PIN</span>
                <span className="block text-ink-dim">Whoever runs the check signs it with their name and the company PIN — works on a shared yard tablet. Only enforced once a PIN is set below.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="cosign" defaultChecked={s?.require_cosign ?? false} className="mt-0.5 h-4 w-4 accent-[#e7ddc7]" />
              <span>
                <span className="block font-medium text-ink">Require second-person sign-off</span>
                <span className="block text-ink-dim">A second hand — a different person than the checker — co-signs every rollout with their name + the company PIN.</span>
              </span>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-ink">Company PIN</span>
              <input name="pin" type="text" inputMode="numeric" placeholder={s?.cosign_pin ? "•••• (set — type to change)" : "e.g. 4718"}
                className="h-11 w-40 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]" />
              <span className="text-xs text-ink-faint">One PIN covers checker sign-on and co-sign. Give it to your leads. Blank keeps the current PIN.</span>
            </label>
            <div><Button type="submit">Save</Button></div>
          </form>
        </Card>
      )}
    </div>
  );
}
