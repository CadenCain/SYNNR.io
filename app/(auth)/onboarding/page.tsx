import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { getSaasUser, getFirstActiveCompany } from "@/lib/saas/auth";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your company · RollReady" };

async function createCompany(formData: FormData) {
  "use server";
  const user = await getSaasUser();
  if (!user) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  const cookieRef = (await cookies()).get("synnr_ref")?.value ?? "";
  const ref = (String(formData.get("ref") ?? "").trim() || cookieRef).slice(0, 60) || null;
  if (!name) return;

  const sb = (await getServerSupabase()) as unknown as SupabaseClient | null;
  if (!sb) redirect("/login");
  // Atomic company + owner membership (SECURITY DEFINER rpc).
  const { error } = await sb.rpc("saas_create_company", { p_name: name });
  if (error) throw new Error(error.message);
  // Referral attribution (?ref=cody → signup → here). Free-text tag for
  // payout math; best-effort, never blocks onboarding.
  if (ref) {
    const { saasAdmin } = await import("@/lib/saas/db");
    const admin = saasAdmin();
    if (admin) {
      const { data: co } = await admin
        .from("saas_companies").select("id").eq("name", name)
        .is("referred_by", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (co) await admin.from("saas_companies").update({ referred_by: ref }).eq("id", (co as { id: string }).id);
    }
  }
  redirect("/onboarding/billing");
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const user = await getSaasUser();
  if (!user) redirect("/login");
  // Already set up? Go straight in.
  if (await getFirstActiveCompany(user.id)) redirect("/app");
  const { ref } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Name your company</h1>
        <p className="mt-1 text-sm text-ink-dim">
          This is your workspace. You&apos;ll add yards, trucks, shops, and certs next.
        </p>
      </div>
      <form action={createCompany} className="flex flex-col gap-4">
        <input type="hidden" name="ref" value={ref ?? ""} />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-ink">Company name</span>
          <input
            name="name"
            type="text"
            required
            autoFocus
            className="h-11 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]"
            placeholder="Ace Wireline Services"
          />
        </label>
        <Button type="submit" className="w-full">Create company</Button>
      </form>
    </div>
  );
}
