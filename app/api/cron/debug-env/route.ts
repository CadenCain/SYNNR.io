import { NextResponse } from "next/server";

// TEMPORARY DEBUG endpoint — DELETE after verifying CRON_SECRET propagation.
// Returns whether key env vars are present at runtime (lengths only, never values).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const keys = ["CRON_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "OPERATOR_EMAILS", "NEXT_PUBLIC_SITE_URL", "RESEND_API_KEY"];
  const result: Record<string, { present: boolean; length: number }> = {};
  for (const k of keys) {
    const v = process.env[k];
    result[k] = { present: v != null && v !== "", length: v ? v.length : 0 };
  }
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    vars: result,
    totalEnvKeys: Object.keys(process.env).length,
  });
}
