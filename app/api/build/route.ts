import { NextResponse } from "next/server";
import { saasAdmin } from "@/lib/saas/db";

/**
 * Custom-build inquiry. Stored in partner_leads with a [BUILD] note prefix so
 * both funnels share one table; emailed to the founder. Same hardening as the
 * partners funnel.
 */
const TO = "cadencain@darkstarops.com";
const FROM = "SYNNR <noreply@synnr.io>";
const MAX_FIELD = 2_000;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export async function POST(req: Request) {
  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ ok: false, error: "invalid form" }, { status: 400 }); }

  const name = String(form.get("name") ?? "").trim();
  const company = String(form.get("company") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();

  if (!name) return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  if (!email && !phone) return NextResponse.json({ ok: false, error: "Give us a phone or an email so we can reach you." }, { status: 400 });
  if (email && !EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  if ([name, company, email, phone, note].some((f) => f.length > MAX_FIELD)) {
    return NextResponse.json({ ok: false, error: "Field too long." }, { status: 413 });
  }

  const admin = saasAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Not configured." }, { status: 500 });

  const { error } = await admin.from("partner_leads").insert({
    name, company: company || null, email: email || null, phone: phone || null,
    note: `[BUILD] ${note}`.slice(0, MAX_FIELD),
  });
  if (error) return NextResponse.json({ ok: false, error: "Couldn't save — call or text 432-250-0715 instead." }, { status: 500 });

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM, to: [TO],
          ...(email && EMAIL_RE.test(email) ? { reply_to: email } : {}),
          subject: `[SYNNR] Custom build inquiry — ${name}${company ? ` (${company})` : ""}`,
          html: `<pre style="font:14px/1.6 -apple-system,sans-serif;white-space:pre-wrap">Name: ${name}\nCompany: ${company || "—"}\nEmail: ${email || "—"}\nPhone: ${phone || "—"}\n\nHeadache:\n${note || "(none)"}</pre>`,
        }),
      });
    } catch { /* stored regardless */ }
  }

  return NextResponse.json({ ok: true });
}
