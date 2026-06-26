import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * Free readiness audit lead funnel.
 * Stores the lead in Supabase (audit_requests) and emails to founder via Resend.
 * Email is best-effort — the lead is always stored.
 */
const TO = "cadencain@darkstarops.com";
const FROM = "SYNNR <noreply@synnr.io>";

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid form" }, { status: 400 });
  }

  const name = String(form.get("name") ?? "").trim();
  const company = String(form.get("company") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const headache = String(form.get("headache") ?? "").trim();
  const role = String(form.get("role") ?? "").trim();
  const runs = String(form.get("runs") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();

  if (!name) return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  if (!/\S+@\S+\.\S+/.test(email)) return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  if (headache.length < 3) return NextResponse.json({ ok: false, error: "Tell us your biggest headache." }, { status: 400 });

  // 1) Store the lead (admin client — server-only, bypasses RLS for a public funnel).
  let stored = false;
  const admin = getAdminSupabase();
  if (admin) {
    const { error } = await admin.from("audit_requests").insert({
      name,
      company: company || null,
      email,
      phone: phone || null,
      service_type: runs || null,
      bottleneck: [role && `Role: ${role}`, `Headache: ${headache}`].filter(Boolean).join("\n"),
      source: "readiness_audit",
    } as never);
    stored = !error;
    if (error) console.error("[readiness-audit] store failed:", error.message);
  }

  // 2) Email the founder's inbox (best-effort).
  let emailed = false;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);
      const text = [
        `New Readiness Audit request`,
        ``,
        `Name:    ${name}`,
        `Company: ${company || "—"}`,
        `Role:    ${role || "—"}`,
        `Runs:    ${runs || "—"}`,
        `Email:   ${email}`,
        `Phone:   ${phone || "—"}`,
        ``,
        `Biggest headache:`,
        headache,
      ].join("\n");
      const { error } = await resend.emails.send({
        from: FROM,
        to: TO,
        replyTo: email,
        subject: `Free Readiness Audit — ${company || name}`,
        text,
      });
      emailed = !error;
      if (error) console.error("[readiness-audit] email failed:", error);
    } catch (e) {
      console.error("[readiness-audit] resend threw:", e instanceof Error ? e.message : e);
    }
  }

  // Mark whether the email went out (best-effort).
  if (admin && stored) {
    await admin.from("audit_requests").update({ emailed } as never).eq("email", email).eq("source", "readiness_audit").is("emailed", null);
  }

  // Never break the funnel: as long as we stored OR emailed, it's a success.
  if (!stored && !emailed) {
    return NextResponse.json({ ok: false, error: "Couldn't reach us — email cadencain@darkstarops.com." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
