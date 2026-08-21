import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * Demo lead capture — "want this loaded with your trucks?" Phone-first on
 * purpose: the buyer is an ops manager who'd rather get a call than an
 * email thread. Same pattern as /api/readiness-audit: store the lead
 * (always), email the founder (best-effort).
 */
const TO = process.env.NOTIFY_EMAIL || "cadencain@synnr.io";
const FROM = "SYNNR <noreply@synnr.io>";
const MAX_FIELD = 500;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid form" }, { status: 400 });
  }

  const name = String(form.get("name") ?? "").trim();
  const company = String(form.get("company") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();

  if (!name) return NextResponse.json({ ok: false, error: "Your name, so I know who I'm calling." }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 7) return NextResponse.json({ ok: false, error: "A cell number I can actually reach you at." }, { status: 400 });
  if (email && !EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: "That email doesn't look right — or just leave it blank." }, { status: 400 });
  if ([name, company, phone, email].some((f) => f.length > MAX_FIELD)) {
    return NextResponse.json({ ok: false, error: "Field too long." }, { status: 413 });
  }

  let stored = false;
  const admin = getAdminSupabase();
  if (admin) {
    const { error } = await admin.from("audit_requests").insert({
      name,
      company: company || null,
      email, // "" when not given — phone is the contact channel for these
      phone,
      bottleneck: "Demo lead: wants SYNNR loaded with their yard's data (free setup).",
      source: "demo",
    } as never);
    if (error) console.error("[demo-lead] store failed:", error.message);
    else stored = true;
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: FROM,
        to: [TO],
        subject: `DEMO LEAD: ${name}${company ? ` — ${company}` : ""} — CALL THEM`,
        text: [
          "Someone in the demo wants it loaded with their yard.",
          "",
          `Name:    ${name}`,
          `Company: ${company || "—"}`,
          `Cell:    ${phone}`,
          `Email:   ${email || "—"}`,
          "",
          stored ? "Stored in audit_requests (source: demo)." : "WARNING: DB store failed — this email is the only copy.",
        ].join("\n"),
      });
    } catch (e) {
      console.error("[demo-lead] email failed:", e instanceof Error ? e.message : e);
    }
  }

  if (!stored && !resendKey) return NextResponse.json({ ok: false, error: "Couldn't save that — call or text me instead." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
