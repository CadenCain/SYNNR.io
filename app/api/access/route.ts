import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * "Request access" from the homepage. Phone first on purpose: the person
 * asking runs a service company and would rather get a call than an email
 * thread. The request is stored (always) and emailed to the founder (best
 * effort). A request that reached neither says so, with the number to call.
 */
const TO = process.env.NOTIFY_EMAIL || "cadencain@synnr.io";
const FROM = "SYNNR <noreply@synnr.io>";
const MAX_FIELD = 300;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "That didn't send. Try again." }, { status: 400 });
  }
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const name = get("name");
  const company = get("company");
  const phone = get("phone");
  const runs = get("runs");
  // A field people can't see. Only a bot fills it in.
  if (get("website")) return NextResponse.json({ ok: true });

  if (!name) return NextResponse.json({ ok: false, error: "Add your name, so we know who we're calling." }, { status: 400 });
  if (!company) return NextResponse.json({ ok: false, error: "Add your company's name." }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 10) return NextResponse.json({ ok: false, error: "Add a cell number with the area code." }, { status: 400 });
  if ([name, company, phone, runs].some((f) => f.length > MAX_FIELD)) {
    return NextResponse.json({ ok: false, error: "That's too long. Shorten it and try again." }, { status: 413 });
  }

  let insertedId: string | null = null;
  const admin = getAdminSupabase();
  if (admin) {
    const { data, error } = await admin.from("audit_requests").insert({
      name, company, email: "", phone,
      service_type: runs || null,
      bottleneck: "Asked for access to SYNNR from the homepage.",
      source: "access",
    } as never).select("id").single();
    if (error) console.error("[access] store failed:", error.message);
    insertedId = (data as { id: string } | null)?.id ?? null;
  }
  const stored = Boolean(insertedId);

  let emailed = false;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const { Resend } = await import("resend");
      // Resend reports failures in the result instead of throwing.
      const { error: sendErr } = await new Resend(resendKey).emails.send({
        from: FROM,
        to: [TO],
        subject: `ACCESS REQUEST: ${name}, ${company}. Call them.`,
        text: [
          "Someone asked for access to SYNNR from the homepage.",
          "",
          `Name:    ${name}`,
          `Company: ${company}`,
          `Cell:    ${phone}`,
          `Runs:    ${runs || "(didn't say)"}`,
          "",
          stored ? "Stored in audit_requests (source: access)." : "WARNING: the database save failed. This email is the only copy.",
        ].join("\n"),
      });
      if (sendErr) console.error("[access] email failed:", sendErr);
      else {
        emailed = true;
        if (admin && insertedId) await admin.from("audit_requests").update({ emailed: true } as never).eq("id", insertedId);
      }
    } catch (e) {
      console.error("[access] email failed:", e instanceof Error ? e.message : e);
    }
  }

  if (!stored && !emailed) return NextResponse.json({ ok: false, error: "That didn't save. Call or text 432-250-0715 instead." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
