import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getSaasUser } from "@/lib/saas/auth";
import { isDemoUser } from "@/lib/saas/plan";
import { Button } from "@/components/ui/button";
import JoinForm from "./join-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join your crew · RollReady", robots: { index: false, follow: false } };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Signed in already: accept and go to the trucks. */
async function accept(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const sb = (await getServerSupabase()) as unknown as SupabaseClient | null;
  if (!sb) redirect("/login");
  const { error } = await sb.rpc("saas_accept_invitation", { p_token: token });
  if (error) redirect(`/invite/${encodeURIComponent(token)}?err=${encodeURIComponent("That invite has expired or was already used. Ask for a new one.")}`);
  redirect("/app?joined=1");
}

/**
 * New to RollReady: make the login and join in one step, from a phone, so a
 * hand goes from the text message to their trucks with one form.
 */
async function joinWithNewLogin(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const back = (m: string) => redirect(`/invite/${encodeURIComponent(token)}?err=${encodeURIComponent(m)}`);
  const fullName = String(formData.get("full_name") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!fullName) back("Add your name. It goes on every scan you make.");
  if (!EMAIL_RE.test(email)) back("That email doesn't look right.");
  if (password.length < 8) back("The password needs at least 8 characters.");

  const sb = (await getServerSupabase()) as unknown as SupabaseClient | null;
  const admin = getAdminSupabase();
  if (!sb || !admin) back("Joining is down for a minute. Try again shortly.");
  const { data: preview } = await sb!.rpc("saas_invitation_preview", { p_token: token });
  const p = (Array.isArray(preview) ? preview[0] : preview) as { valid: boolean } | null;
  if (!p?.valid) back("That invite has expired or was already used. Ask for a new one.");

  const { error: createErr } = await admin!.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (createErr) {
    back(/already.*registered|exists/i.test(createErr.message)
      ? "That email already has a login. Use Log in below, then accept."
      : "Couldn't make the login. Try again.");
  }
  const { error: signErr } = await sb!.auth.signInWithPassword({ email, password });
  if (signErr) redirect(`/login?next=/invite/${encodeURIComponent(token)}`);
  const { error: acceptErr } = await sb!.rpc("saas_accept_invitation", { p_token: token });
  if (acceptErr) back("That invite has expired or was already used. Ask for a new one.");
  redirect("/app?joined=1");
}

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ err?: string }> }) {
  const { token } = await params;
  const { err } = await searchParams;
  const sb = (await getServerSupabase()) as unknown as SupabaseClient | null;
  let preview: { company_name: string; role: string; valid: boolean } | null = null;
  if (sb) {
    const { data } = await sb.rpc("saas_invitation_preview", { p_token: token });
    preview = (Array.isArray(data) ? data[0] : data) ?? null;
  }
  const user = await getSaasUser();
  // Still in the live demo on this phone? Leave it and come back here.
  if (user && isDemoUser(user)) redirect(`/demo/exit?next=/invite/${encodeURIComponent(token)}`);
  const asWhat = preview?.role === "admin" ? "a manager" : "a hand";

  return (
    <div className="saas flex min-h-dvh items-start justify-center bg-coal px-4 pt-10 text-ink antialiased sm:items-center sm:pt-0">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden className="h-6 w-6">
            <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" className="fill-bone" />
          </svg>
          <span className="font-semibold tracking-tight">RollReady</span>
        </div>

        {!preview || !preview.valid ? (
          <>
            <h1 className="text-lg font-semibold">This invite doesn&apos;t work anymore</h1>
            <p className="mt-1 text-sm text-ink-dim">It expired or was already used. Ask your manager to send a new one from Settings, Team.</p>
            <Link href="/" className="mt-4 inline-block text-sm text-[#1d4ed8] hover:underline">← Home</Link>
          </>
        ) : !user ? (
          <>
            <h1 className="text-xl font-semibold">Join {preview.company_name}</h1>
            <p className="mt-1 text-sm text-ink-dim">You&apos;re joining as {asWhat}. Make your login and you&apos;ll go straight to the trucks.</p>
            <JoinForm action={joinWithNewLogin} token={token} error={err} />
            <p className="mt-4 text-center text-sm text-ink-dim">Already have a RollReady login? <Link href={`/login?next=/invite/${token}`} className="font-medium text-[#1d4ed8] hover:underline">Log in</Link></p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Join {preview.company_name}</h1>
            <p className="mt-1 text-sm text-ink-dim">You&apos;ll join as {asWhat}, as {(user.user_metadata?.full_name as string | undefined) ?? user.email}.</p>
            {err ? <p className="mt-2 text-sm text-red-400">{err}</p> : null}
            <form action={accept} className="mt-4">
              <input type="hidden" name="token" value={token} />
              <Button type="submit" className="h-12 w-full text-base">Join the crew</Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
