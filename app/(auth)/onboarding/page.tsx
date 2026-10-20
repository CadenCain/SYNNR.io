import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { getSaasUser, getFirstActiveCompany } from "@/lib/saas/auth";
import { saasAdmin } from "@/lib/saas/db";
import { clampYards } from "@/lib/saas/plan";
import OnboardingForm from "./onboarding-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your company · RollReady" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v: FormDataEntryValue | null, n: number) => String(v ?? "").trim().slice(0, n);

/**
 * Getting started, step 2 (after the account): the company, a contact, and
 * how many yards. Makes the company with this person as owner, keeps what
 * they told us, then shows the total and goes to Stripe.
 */
async function createCompany(formData: FormData) {
  "use server";
  const user = await getSaasUser();
  if (!user) redirect("/login");
  const name = clip(formData.get("name"), 120);
  const contactName = clip(formData.get("contact_name"), 120);
  const contactEmail = clip(formData.get("contact_email"), 200).toLowerCase();
  const contactPhone = clip(formData.get("contact_phone"), 40);
  const yards = clampYards(formData.get("yards"));
  const heard = clip(formData.get("heard_about"), 120) || null;
  const notes = clip(formData.get("notes"), 1000) || null;
  const bad = (m: string) => redirect(`/onboarding?err=${encodeURIComponent(m)}`);
  if (!name) bad("Add your company's name.");
  if (!contactName) bad("Add your name.");
  if (!EMAIL_RE.test(contactEmail)) bad("That email doesn't look right.");
  if (contactPhone.replace(/\D/g, "").length < 10) bad("Add a phone number with the area code.");

  const cookieRef = (await cookies()).get("synnr_ref")?.value ?? "";
  const ref = (clip(formData.get("ref"), 60) || cookieRef).slice(0, 60) || null;

  const sb = (await getServerSupabase()) as unknown as SupabaseClient | null;
  if (!sb) redirect("/login");
  // Company + this person as its owner, in one step (SECURITY DEFINER rpc).
  const { data: newId, error } = await sb.rpc("saas_create_company", { p_name: name });
  if (error) bad("Couldn't create the company. Try again.");
  const companyId = (newId as string | null) ?? (await getFirstActiveCompany(user.id))?.id ?? null;

  const admin = saasAdmin();
  if (admin && companyId) {
    await admin.from("saas_companies").update({
      contact_name: contactName, contact_email: contactEmail, contact_phone: contactPhone,
      requested_yards: yards, heard_about: heard, signup_notes: notes,
    }).eq("id", companyId);
    // Referral (?ref=cody): stamped once, on the company this person just made.
    if (ref) await admin.from("saas_companies").update({ referred_by: ref }).eq("id", companyId).is("referred_by", null);
    // Records carry a person's name; if signup didn't get one, this did.
    if (!(user.user_metadata?.full_name as string | undefined)?.trim()) {
      await admin.auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, full_name: contactName } }).catch(() => {});
    }
  }
  redirect("/onboarding/billing");
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ ref?: string; err?: string }> }) {
  const user = await getSaasUser();
  if (!user) redirect("/signup");
  // Already have a company? Paid goes to the app; unpaid goes to checkout.
  if (await getFirstActiveCompany(user.id)) redirect("/app");
  const { ref, err } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-ink-faint">Step 2 of 3</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Set up your company</h1>
        <p className="mt-1 text-sm text-ink-dim">Who you are and how many yards you run. Next is payment, then you&apos;re in.</p>
      </div>
      <OnboardingForm action={createCompany} error={err}
        defaults={{ contactName: (user.user_metadata?.full_name as string | undefined)?.trim() ?? "", email: user.email ?? "", ref: ref ?? "" }} />
    </div>
  );
}
