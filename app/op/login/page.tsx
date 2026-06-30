import { redirect } from "next/navigation";
import { getOperator, isAllowedOperatorEmail } from "@/lib/op/auth";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Operator sign-in. Single allowed email → magic link. We deliberately do not
 * reveal whether an email is allowed (no enumeration): the form always says
 * "if your email is recognized, a link is on the way," but we only actually
 * send the magic link when the email is in the allowlist.
 */
export const dynamic = "force-dynamic";

async function sendLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;

  // Always show the same success state — but only burn an OTP send for an
  // allowlisted address.
  if (isAllowedOperatorEmail(email)) {
    const supabase = await getServerSupabase();
    if (supabase) {
      const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${origin}/op` },
      });
    }
  }
  redirect("/op/login?sent=1");
}

export default async function OpLoginPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  // Already signed in? Skip the form.
  const op = await getOperator();
  if (op) redirect("/op");

  const sp = await searchParams;
  const sent = sp.sent === "1";

  return (
    <div className="op-login-wrap">
      <div className="op-login-card">
        <h1>SYNNR operator sign-in</h1>
        <p>This is not the shop login. SYNNR shops don&apos;t log in — we run it for them.</p>

        {sent ? (
          <p className="op-login-ok">
            If your email is recognized, a sign-in link is on the way. Open it on this device.
          </p>
        ) : (
          <form action={sendLink} className="op-form">
            <label>
              Email
              <input type="email" name="email" required autoComplete="email" placeholder="you@…" />
            </label>
            <button className="op-btn op-btn-primary" type="submit">Send sign-in link</button>
          </form>
        )}
      </div>
    </div>
  );
}
