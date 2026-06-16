import { NextResponse } from "next/server";

/** TEMP presence check — booleans only, no secret values. Remove after go-live. */
export async function GET() {
  const sk = process.env.STRIPE_SECRET_KEY || "";
  return NextResponse.json({
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    AI_GATEWAY_API_KEY: !!process.env.AI_GATEWAY_API_KEY,
    STRIPE_SECRET_KEY_mode: sk.startsWith("sk_live_") ? "LIVE" : sk ? "set" : "ABSENT",
    STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_TALLYSHOT_SEAT: !!process.env.STRIPE_PRICE_TALLYSHOT_SEAT,
  });
}
