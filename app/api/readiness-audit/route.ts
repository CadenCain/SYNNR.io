import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * Free readiness audit lead funnel.
 * Stores the lead in Supabase (audit_requests) and emails to founder via Resend.
 * Email is best-effort — the lead is always stored.
 */
const TO = process.env.NOTIFY_EMAIL || "cadencain@synnr.io";
const FROM = "SYNNR <noreply@synnr.io>";
const MAX_FIELD = 4_000; // per-field char cap — leaves room for any legitimate "tell us about your shop" payload while killing 5MB bot pastes.

// Anchored so substring matches like "me@shop.com please call back" can't slip
// past validation and get stored / sent to Resend as replyTo.
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
  const email = String(form.get("email") ?? "").trim();
  const headache = String(form.get("headache") ?? "").trim();
  const role = String(form.get("role") ?? "").trim();
  const runs = String(form.get("runs") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();

  if (!name) return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  if (headache.length < 3) return NextResponse.json({ ok: false, error: "Tell us your biggest headache." }, { status: 400 });
  if (name.length > MAX_FIELD || company.length > MAX_FIELD || email.length > MAX_FIELD ||
      headache.length > MAX_FIELD || role.length > MAX_FIELD || runs.length > MAX_FIELD || phone.length > MAX_FIELD) {
    return NextResponse.json({ ok: false, error: "Field too long." }, { status: 413 });
  }

  // 1) Store the lead (admin client — server-only, bypasses RLS for a public funnel).
  //    Capture the inserted row id so step 3 can update THAT row by id — without
  //    that we'd match by (email, source) and clobber prior submissions from
  //    repeat shops.
  let insertedId: string | null = null;
  const admin = getAdminSupabase();
  if (admin) {
    const { data, error } = await admin
      .from("audit_requests")
      .insert({
        name,
        company: company || null,
        email,
        phone: phone || null,
        service_type: runs || null,
        bottleneck: [role && `Role: ${role}`, `Headache: ${headache}`].filter(Boolean).join("\n"),
        source: "readiness_audit",
      } as never)
      .select("id")
      .single();
    if (error) console.error("[readiness-audit] store failed:", error.message);
    insertedId = (data as { id: string } | null)?.id ?? null;
  }
  const stored = !!insertedId;

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

  // 3) Flag emailed on the SAME row we just inserted (by id). The old code
  //    filtered by `.is('emailed', null)` on a NOT-NULL boolean column — that
  //    matched zero rows and never persisted the flag.
  if (admin && insertedId && emailed) {
    await admin.from("audit_requests").update({ emailed: true } as never).eq("id", insertedId);
  }

  // Never break the funnel: as long as we stored OR emailed, it's a success.
  if (!stored && !emailed) {
    return NextResponse.json({ ok: false, error: "Couldn't reach us — email cadencain@synnr.io." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
