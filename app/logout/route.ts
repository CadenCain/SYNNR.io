import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/** Sign out from a plain link (the payment page has no app menu), then home. */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sb = await getServerSupabase();
  if (sb) await sb.auth.signOut().catch(() => {});
  return NextResponse.redirect(new URL("/", req.url), 303);
}
