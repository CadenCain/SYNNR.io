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
import { tellOwner, monthly } from "@/lib/saas/tell-owner";

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
  // Heads-up to call them back, whether or not they finish paying.
  tellOwner(`RollReady signup started: ${name}`, [
    `${name}, ${yards} ${yards === 1 ? "yard" : "yards"} (${monthly(yards)}).`,
    `${fullName || "No name"}, ${user.email ?? "no email"}, ${phone}.`,
    ref ? `Came from: ${ref}` : null,
    "They're on their way to Stripe now. If no payment email follows, give them a call.",
  ]);

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
  // On a paid crew already: that's where they belong. Their own company would
  // need its own login (one email, one company to start from here).
  if (company && !mustSubscribe(company)) {
    if (company.role === "owner") redirect("/app");
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold tracking-tight">You&apos;re on {company.name}</h1>
        <p className="text-sm text-ink-dim">This login is on {company.name}&apos;s crew. To start your own company in RollReady, sign up with a different email, or call or text 432-250-0715 and we&apos;ll set it up.</p>
        <a href="/app" className="inline-flex h-12 items-center justify-center rounded-lg bg-bone px-4 text-base font-semibold text-on-bone">Go to {company.name}&apos;s trucks</a>
      </div>
    );
  }
  // Taken off a crew, with no company of their own: not a sign-up.
  if (!company) {
    const admin = saasAdmin();
    const { data: gone } = admin
      ? await admin.from("saas_memberships").select("company_id").eq("user_id", user.id).eq("status", "removed").limit(1).maybeSingle()
      : { data: null };
    if (gone) {
      return (
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold tracking-tight">You&apos;re not on a crew anymore</h1>
          <p className="text-sm text-ink-dim">A manager took this login off the crew. Ask them for a new invite, or start your own company with a different email.</p>
          <a href="/logout" className="inline-flex h-12 items-center justify-center rounded-lg border border-line-2 px-4 text-base font-medium text-ink">Log out</a>
        </div>
      );
    }
  }
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
