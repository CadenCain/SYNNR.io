import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { getSaasUser, getFirstActiveCompany } from "@/lib/saas/auth";
import { saasAdmin } from "@/lib/saas/db";
import { getStripe } from "@/lib/stripe";
import { clampYards, isDemoUser, mustSubscribe } from "@/lib/saas/plan";
import { createYardCheckout, siteOrigin } from "@/lib/saas/onboarding";
import OnboardingForm from "./onboarding-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your company · RollReady" };

const clip = (v: FormDataEntryValue | null, n: number) => String(v ?? "").trim().slice(0, n);

/**
 * Getting started, step 2: the company and its yards, then straight to
 * Stripe. The company is saved now (unpaid, so the app stays closed) so the
 * checkout belongs to it; paying turns it on and makes the yards.
 */
async function startCompany(formData: FormData) {
  "use server";
  const user = await getSaasUser();
  if (!user) redirect("/signup");
  if (isDemoUser(user)) redirect("/demo/exit?to=signup");
  const name = clip(formData.get("name"), 120);
  const phone = clip(formData.get("contact_phone"), 40);
  const yards = clampYards(formData.get("yards"));
  const firstYard = clip(formData.get("first_yard"), 80) || null;
  const bad = (m: string) => redirect(`/onboarding?err=${encodeURIComponent(m)}`);
  if (!name) bad("Add your company's name.");
  if (phone.replace(/\D/g, "").length < 10) bad("Add a phone number with the area code.");

  const admin = saasAdmin();
  const stripe = getStripe();
  if (!admin) bad("Sign-up is down for a minute. Call or text 432-250-0715.");

  // Back button or a double tap: reuse their unpaid company, never make a second.
  const existing = await getFirstActiveCompany(user.id);
  if (existing && !mustSubscribe(existing)) redirect("/app");
  let companyId = existing?.id ?? null;
  if (!companyId) {
    const sb = (await getServerSupabase()) as unknown as SupabaseClient | null;
    if (!sb) redirect("/login");
    const { data: newId, error } = await sb.rpc("saas_create_company", { p_name: name });
    if (error) bad("Couldn't save the company. Try again.");
    companyId = (newId as string | null) ?? (await getFirstActiveCompany(user.id))?.id ?? null;
  }
  if (!companyId) bad("Couldn't save the company. Try again.");

  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim() || null;
  await admin!.from("saas_companies").update({
    ...(existing ? { name } : {}),
    contact_name: fullName, contact_email: user.email ?? null, contact_phone: phone,
    requested_yards: yards, first_yard_name: firstYard,
  }).eq("id", companyId!);
  const cookieRef = (await cookies()).get("synnr_ref")?.value ?? "";
  const ref = (clip(formData.get("ref"), 60) || cookieRef).slice(0, 60) || null;
  if (ref) await admin!.from("saas_companies").update({ referred_by: ref }).eq("id", companyId!).is("referred_by", null);

  if (!stripe) redirect("/onboarding/billing");
  let url: string | null = null;
  try {
    const s = await createYardCheckout(stripe, admin!, {
      companyId: companyId!, companyName: name, userEmail: user.email ?? null, quantity: yards, origin: siteOrigin(await headers()),
    });
    url = s.url;
  } catch (e) {
    console.error("[onboarding] checkout:", e instanceof Error ? e.message : e);
  }
  // redirect() throws, so it stays outside the try.
  redirect(url ?? "/onboarding/billing?err=checkout");
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ ref?: string; err?: string }> }) {
  const user = await getSaasUser();
  if (!user) redirect("/signup");
  // In the demo? Leave it cleanly and start a real account.
  if (isDemoUser(user)) redirect("/demo/exit?to=signup");
  const company = await getFirstActiveCompany(user.id);
  if (company && !mustSubscribe(company)) redirect("/app");
  const { ref, err } = await searchParams;

  // Coming back to an unpaid company: start from what they typed.
  const admin = saasAdmin();
  const { data } = company && admin
    ? await admin.from("saas_companies").select("contact_phone, requested_yards, first_yard_name").eq("id", company.id).maybeSingle()
    : { data: null };
  const prev = data as { contact_phone: string | null; requested_yards: number | null; first_yard_name: string | null } | null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-ink-faint">Step 2 of 3</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Your company and yards</h1>
        <p className="mt-1 text-sm text-ink-dim">Next is payment, then you&apos;re in.</p>
      </div>
      <OnboardingForm action={startCompany} error={err}
        defaults={{ companyName: company?.name ?? "", phone: prev?.contact_phone ?? "", yards: prev?.requested_yards ?? 1, firstYard: prev?.first_yard_name ?? "", ref: ref ?? "" }} />
    </div>
  );
}
