import { NextResponse } from "next/server";
import { saasAdmin } from "@/lib/saas/db";
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
      user_metadata: { full_name: "Boss", is_demo: true },
    });
    if (userErr || !created.user) throw new Error(userErr?.message ?? "user create failed");

    await seedDemoCompany(admin, created.user.id);

    const { error: signErr } = await sb.auth.signInWithPassword({ email, password });
    if (signErr) throw new Error(signErr.message);

    return NextResponse.redirect(new URL("/app", req.url), 303);
  } catch (e) {
    console.error("[demo] start failed:", e instanceof Error ? e.message : e);
    return back("err=seed");
  }
}
