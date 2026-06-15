import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Agency lead funnel — the Operations Audit questionnaire posts here.
 * Always persists the lead (so nothing is ever lost), then emails
 * cadencain@darkstarops.com via Resend IF RESEND_API_KEY is configured.
 * Works today (DB capture) and starts emailing the moment the key is set.
 */
const TO = "cadencain@darkstarops.com";
const FROM = process.env.AUDIT_FROM_EMAIL || "SYNNR <onboarding@resend.dev>";

export async function POST(req: Request) {
  let body: Record<string, string> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad body" }, { status: 400 }); }

  const email = (body.email || "").trim();
  if (!/\S+@\S+\.\S+/.test(email)) return NextResponse.json({ ok: false, error: "A valid work email is required." }, { status: 400 });

  const lead = {
    company: body.company?.trim() || null,
    name: body.name?.trim() || null,
    email,
    phone: body.phone?.trim() || null,
    service_type: body.serviceType?.trim() || null,
    fleet_size: body.fleetSize?.trim() || null,
    bottleneck: body.bottleneck?.trim() || null,
    source: "website-audit",
  };

  const supabase = await getServerSupabase();
  let stored = false;
  if (supabase) {
    // No .select() — anon may INSERT but not SELECT, and a RETURNING read would
    // roll the insert back. Mirror /api/lead: insert-only, check error.
    const { error } = await supabase.from("audit_requests").insert(lead);
    if (!error) stored = true;
  }

  // Best-effort email notification (only if Resend is configured).
  let emailed = false;
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const text = [
        `New Operations Audit request — synnr.io`,
        ``,
        `Company:   ${lead.company || "—"}`,
        `Name:      ${lead.name || "—"}`,
        `Email:     ${lead.email}`,
        `Phone:     ${lead.phone || "—"}`,
        `Service:   ${lead.service_type || "—"}`,
        `Fleet:     ${lead.fleet_size || "—"} trucks/crews`,
        ``,
        `Biggest bottleneck:`,
        lead.bottleneck || "—",
      ].join("\n");
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [TO], reply_to: lead.email, subject: `Ops Audit request — ${lead.company || lead.email}`, text }),
      });
      emailed = r.ok;
    } catch {
      /* email is best-effort; the lead is already stored */
    }
  }

  if (!stored && !emailed) {
    return NextResponse.json({ ok: false, error: "Couldn't submit — please email cadencain@darkstarops.com directly." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, stored, emailed });
}
