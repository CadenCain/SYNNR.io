import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { getSaasUser, getFirstActiveCompany } from "@/lib/saas/auth";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your company · SYNNR" };

async function createCompany(formData: FormData) {
  "use server";
  const user = await getSaasUser();
  if (!user) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const sb = (await getServerSupabase()) as unknown as SupabaseClient | null;
  if (!sb) redirect("/login");
  // Atomic company + owner membership (SECURITY DEFINER rpc).
  const { error } = await sb.rpc("saas_create_company", { p_name: name });
  if (error) throw new Error(error.message);
  redirect("/onboarding/billing");
}

export default async function OnboardingPage() {
  const user = await getSaasUser();
  if (!user) redirect("/login");
  // Already set up? Go straight in.
  if (await getFirstActiveCompany(user.id)) redirect("/app");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Name your company</h1>
        <p className="mt-1 text-sm text-ink-dim">
          This is your workspace. You&apos;ll add yards, trucks, shops, and certs next.
        </p>
      </div>
      <form action={createCompany} className="flex flex-col gap-4">
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
