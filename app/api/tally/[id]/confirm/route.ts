import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { getSignedInOrg, requireProductApi } from "@/lib/marketplace/access";

/**
 * Human sign-off on a saved tally — the trust layer. A record isn't "final"
 * until a person reviewed the flagged digits and accepted it. Stamps who + when.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProductApi("tallyshot");
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.reason }, { status: gate.status });

  const org = await getSignedInOrg();
  const supabase = await getServerSupabase();
  if (!org || !supabase) return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });

  const { error } = await supabase
    .from("tallies")
    .update({ confirmed_by: org.userId, confirmed_by_email: org.email, confirmed_at: new Date().toISOString() })
    .eq("id", id); // RLS scopes to the caller's org

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
