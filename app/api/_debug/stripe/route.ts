import { NextResponse } from "next/server";

/**
 * TEMPORARY diagnostic — reports which Stripe-related env vars the LIVE runtime
 * actually sees. Returns presence booleans + key MODE only (sk_live vs sk_test),
 * never the secret values. Price IDs are not secret. Remove after go-live.
 */
export async function GET() {
  const sk = process.env.STRIPE_SECRET_KEY || "";
  const mode = sk.startsWith("sk_live_") ? "LIVE" : sk.startsWith("sk_test_") ? "TEST/SANDBOX" : sk ? "unknown-prefix" : "ABSENT";
  return NextResponse.json({
    STRIPE_SECRET_KEY: { present: !!sk, mode },
    STRIPE_WEBHOOK_SECRET: { present: !!process.env.STRIPE_WEBHOOK_SECRET },
    STRIPE_PRICE_TALLYSHOT_SEAT: process.env.STRIPE_PRICE_TALLYSHOT_SEAT || "ABSENT",
    AI_GATEWAY_API_KEY: { present: !!process.env.AI_GATEWAY_API_KEY },
    deployedAt: process.env.VERCEL_DEPLOYMENT_ID ? "vercel" : "unknown",
  });
}
