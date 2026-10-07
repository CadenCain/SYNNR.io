import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saasAdmin } from "@/lib/saas/db";
import { sendEmail } from "@/lib/saas/notify";
import { fmtWhen } from "@/lib/saas/format";
import { getServerSupabase } from "@/lib/supabase/server";
import { seedDemoCompany } from "@/lib/saas/demo-seed";

/**
 * One click → your own private demo yard.
 *
 * POST-only on purpose (a GET that writes gets prefetched by link scanners).
 * Creates a throwaway auth user + a fresh seeded copy of the Caprock demo
 * company (comped, is_demo), signs the visitor in with real session cookies,
 * and drops them on the real dashboard. RLS tenancy is the sandbox; the
 * reaper deletes the whole thing after 24h.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const back = (q: string) => NextResponse.redirect(new URL(`/demo?${q}`, req.url), 303);
  const admin = saasAdmin();
  const sb = await getServerSupabase();
  if (!admin || !sb) return back("err=unavailable");

  // Abuse valve: cap fresh demo yards per hour. Legit traffic never hits it;
  // a script does, and gets the "busy" screen instead of a database bill.
  const hourAgo = new Date(Date.now() - 3600e3).toISOString();
  const { count } = await admin.from("saas_companies")
    .select("id", { count: "exact", head: true }).eq("is_demo", true).gte("created_at", hourAgo);
  if ((count ?? 0) >= 25) return back("busy=1");

  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const email = `demo-${rand}@demo.synnr.io`;
  const password = crypto.randomUUID() + crypto.randomUUID();

  try {
    const { data: created, error: userErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: "Demo manager", is_demo: true },
    });
    if (userErr || !created.user) throw new Error(userErr?.message ?? "user create failed");

    await seedDemoCompany(admin, created.user.id);

    const { error: signErr } = await sb.auth.signInWithPassword({ email, password });
    if (signErr) throw new Error(signErr.message);

    // Opened from a tracked outreach link (synnr.io/demo?ref=<shop>)? Tell
    // Caden right away: that shop is clicking around the demo yard now.
    // Only a real click on the button gets here (it's a POST), so email
    // link scanners that open the page don't count.
    const ref = ((await cookies()).get("synnr_ref")?.value ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
    if (ref) after(() => tellCadenDemoOpened(admin, ref));

    return NextResponse.redirect(new URL("/app", req.url), 303);
  } catch (e) {
    console.error("[demo] start failed:", e instanceof Error ? e.message : e);
    return back("err=seed");
  }
}

async function tellCadenDemoOpened(admin: SupabaseClient, ref: string): Promise<void> {
  const when = fmtWhen(new Date().toISOString());
  const { data } = await admin.from("audit_requests").insert({
    company: ref, email: "", source: "demo_opened",
    bottleneck: `Opened the demo yard from a tracked link (ref=${ref}) at ${when} CT`,
  } as never).select("id").single();
  const sent = await sendEmail([process.env.NOTIFY_EMAIL || "cadencain@synnr.io"], `Demo opened: ${ref}`,
    `<p style="font:15px/1.5 -apple-system,sans-serif">Someone who got your link for <b>${ref}</b> just opened the demo yard (${when} CT). They're looking at it now.</p>` +
    `<p style="font:15px/1.5 -apple-system,sans-serif">Call them today while it's fresh.</p>`);
  const id = (data as { id: string } | null)?.id;
  if (sent && id) await admin.from("audit_requests").update({ emailed: true } as never).eq("id", id);
}
