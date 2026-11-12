import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getSaasUser } from "@/lib/saas/auth";
import { isDemoUser } from "@/lib/saas/plan";
import { isAllowedOperatorEmail } from "@/lib/op/auth";
import { Button } from "@/components/ui/button";
import JoinForm from "./join-form";
import { logEventNow } from "@/lib/saas/notify";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join your crew · SYNNR", robots: { index: false, follow: false } };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Why joining didn't work, in words a hand can act on. */
const joinError = (message: string) => /removed/i.test(message)
  ? "A manager took you off this crew. Ask them for a personal invite."
  : "That invite has expired or was already used. Ask for a new one.";

/** Joined: it goes in the feed so the manager sees who's on. */
async function noteJoin(sb: SupabaseClient, companyId: unknown) {
  const { data } = await sb.auth.getUser();
  const u = data.user;
  if (!u || typeof companyId !== "string") return;
  const name = (u.user_metadata?.full_name as string | undefined)?.trim() || u.email?.split("@")[0] || "Someone";
  await logEventNow({ companyId, kind: "crew_joined", actor: name, message: `${name} joined the crew` });
  // Open the company just joined (someone already on another crew would
  // otherwise land in their first one).
  (await cookies()).set("synnr_co", companyId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

/** Signed in already: accept and go in. */
async function accept(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const sb = (await getServerSupabase()) as unknown as SupabaseClient | null;
  if (!sb) redirect("/login");
  const { data: companyId, error } = await sb.rpc("saas_accept_invitation", { p_token: token });
  if (error) redirect(`/invite/${encodeURIComponent(token)}?err=${encodeURIComponent(joinError(error.message))}`);
  await noteJoin(sb, companyId);
  redirect("/app?joined=1");
}

/**
 * New to SYNNR: make the login and join in one step, from a phone, so a
 * hand goes from the text message to SYNNR with one form.
 */
async function joinWithNewLogin(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const back = (m: string) => redirect(`/invite/${encodeURIComponent(token)}?err=${encodeURIComponent(m)}`);
  const fullName = String(formData.get("full_name") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!fullName) back("Add your name. It goes on every piece you load.");
  if (!EMAIL_RE.test(email)) back("That email doesn't look right.");
  if (isAllowedOperatorEmail(email)) back("That email can't be used for a crew login. Use your own.");
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
  const { data: companyId, error: acceptErr } = await sb!.rpc("saas_accept_invitation", { p_token: token });
  if (acceptErr) back(joinError(acceptErr.message));
  await noteJoin(sb!, companyId);
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
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-7">
        <div className="mb-6"><Wordmark /></div>

        {!preview || !preview.valid ? (
          <>
            <h1 className="text-lg font-semibold">This invite doesn&apos;t work anymore</h1>
            <p className="mt-1 text-sm text-ink-dim">It expired or was already used. Ask your manager for the crew link from Settings, Team.</p>
            <p className="mt-3 text-sm text-ink-dim">Already on the crew? <Link href="/login" className="font-medium text-ink underline underline-offset-4">Log in</Link> to get in.</p>
          </>
        ) : !user ? (
          <>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Join {preview.company_name}</h1>
            <p className="mt-1 text-sm text-ink-dim">You&apos;re joining as {asWhat}. Make your login and you&apos;re in.</p>
            <JoinForm key={err ?? ""} action={joinWithNewLogin} token={token} error={err} />
            <p className="mt-4 text-center text-sm text-ink-dim">Already have a SYNNR login? <Link href={`/login?next=/invite/${token}`} className="font-medium text-ink underline-offset-4 hover:underline">Log in</Link></p>
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Join {preview.company_name}</h1>
            <p className="mt-1 text-sm text-ink-dim">You&apos;ll join as {asWhat}, as {(user.user_metadata?.full_name as string | undefined) ?? user.email}.</p>
            {err ? <p className="mt-2 text-sm text-red-400">{err}</p> : null}
            <form action={accept} className="mt-4">
              <input type="hidden" name="token" value={token} />
              <Button type="submit" className="h-11 w-full md:h-11 md:text-sm">Join the crew</Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
