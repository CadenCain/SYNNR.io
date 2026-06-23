import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * Custom Builds "free Operations Audit" lead funnel (/services).
 * Stores the lead in Supabase (audit_requests) so nothing is ever lost, AND
 * emails it to the founder's inbox via Resend with the uploaded file attached.
 * Email degrades gracefully: if RESEND_API_KEY isn't set the lead is still
 * stored and the funnel returns success.
 *
 * Accepts multipart/form-data: name, company, email, bottleneck, file (optional).
 */
const TO = "cadencain@synnr.io";
const FROM = "SYNNR <noreply@synnr.io>";
const MAX_ATTACH_BYTES = 10 * 1024 * 1024; // 10 MB

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
  const bottleneck = String(form.get("bottleneck") ?? "").trim();
  const role = String(form.get("role") ?? "").trim();
  const runs = String(form.get("runs") ?? "").trim();   // wireline / coil / cementing / construction / other
  const hurts = String(form.get("hurts") ?? "").trim(); // tools / certs / paperwork / dispatch / billing
  const phone = String(form.get("phone") ?? "").trim();
  const file = form.get("file");

  if (!name) return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  if (!/\S+@\S+\.\S+/.test(email)) return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  if (bottleneck.length < 3) return NextResponse.json({ ok: false, error: "Tell us the bottleneck." }, { status: 400 });

  // Read the optional attachment (cap size to keep the email deliverable).
  let attachment: { filename: string; content: string } | null = null;
  let attachNote = "No file attached.";
  if (file && typeof file === "object" && "arrayBuffer" in file && (file as File).size > 0) {
    const f = file as File;
    if (f.size > MAX_ATTACH_BYTES) {
      attachNote = `File "${f.name}" was too large to attach (${(f.size / 1048576).toFixed(1)} MB) — follow up with ${email}.`;
    } else {
      const buf = Buffer.from(await f.arrayBuffer());
      attachment = { filename: f.name || "upload", content: buf.toString("base64") };
      attachNote = `Attached: ${f.name} (${(f.size / 1024).toFixed(0)} KB)`;
    }
  }

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
      bottleneck: [role && `Role: ${role}`, hurts && `Hurts most: ${hurts}`, bottleneck].filter(Boolean).join("\n"),
      source: "readiness_map",
    } as never);
    stored = !error;
    if (error) console.error("[services-lead] store failed:", error.message);
  }

  // 2) Email the founder's inbox (best-effort).
  let emailed = false;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);
      const text = [
        `New Readiness Map request`,
        ``,
        `Name:    ${name}`,
        `Company: ${company || "—"}`,
        `Role:    ${role || "—"}`,
        `Runs:    ${runs || "—"}`,
        `Hurts:   ${hurts || "—"}`,
        `Email:   ${email}`,
        `Phone:   ${phone || "—"}`,
        ``,
        `Job packet / where it hurts:`,
        bottleneck,
        ``,
        attachNote,
      ].join("\n");
      const { error } = await resend.emails.send({
        from: FROM,
        to: TO,
        replyTo: email,
        subject: `Readiness Map — ${company || name}`,
        text,
        ...(attachment ? { attachments: [attachment] } : {}),
      });
      emailed = !error;
      if (error) console.error("[services-lead] email failed:", error);
    } catch (e) {
      console.error("[services-lead] resend threw:", e instanceof Error ? e.message : e);
    }
  }

  // Mark whether the email went out (best-effort).
  if (admin && stored) {
    await admin.from("audit_requests").update({ emailed } as never).eq("email", email).eq("source", "readiness_map").is("emailed", null);
  }

  // Never break the funnel: as long as we stored OR emailed, it's a success.
  if (!stored && !emailed) {
    return NextResponse.json({ ok: false, error: "Couldn't reach us — email cadencain@darkstarops.com." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
