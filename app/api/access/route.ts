import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * "Request access" from the homepage. Phone first on purpose: the person
 * asking runs a service company and would rather get a call than an email
 * thread. The request is stored (always) and emailed to the founder (best
 * effort). A request that reached neither says so, with the number to call.
 *
 * A lead is never dropped quietly. One that was saved but not emailed (the
 * email failed, the hourly cap was hit, or the spam trap caught it) goes out
 * in the next morning's note to the operator (app/api/cron/daily).
 */
const TO = process.env.NOTIFY_EMAIL || "cadencain@synnr.io";
const FROM = "SYNNR <noreply@synnr.io>";
const MAX_FIELD = 300;
/** Emails this form may send in an hour. Past it, requests are still saved, and go out in the morning note. */
const EMAILS_AN_HOUR = 15;

/** The form normally sends from the page's own script. If it was sent before the script loaded, the browser shows this instead of raw data. */
function page(title: string, body: string, status: number) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title} · SYNNR</title></head>` +
    `<body style="margin:0;background:#08090a;color:#f4f4f5;font:17px/1.6 -apple-system,'Segoe UI',Arial,sans-serif"><main style="max-width:32rem;margin:0 auto;padding:4rem 1.25rem">` +
    `<h1 style="font-size:1.75rem;margin:0 0 .75rem">${title}</h1><p style="color:#a1a4ab;margin:0 0 1.5rem">${body}</p><a href="/" style="color:#f4f4f5">Back to synnr.io</a></main></body></html>`;
  return new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  // A plain browser form post (no script yet) gets a page back; the page's own script gets data.
  const plain = req.headers.get("sec-fetch-mode") === "navigate";
  const no = (error: string, status: number) => plain ? page("That didn't go through", `${error} Or call or text 432-250-0715.`, status) : NextResponse.json({ ok: false, error }, { status });
  const yes = () => plain ? page("Got it.", "Caden will call you. If you'd rather not wait, call or text 432-250-0715.", 200) : NextResponse.json({ ok: true });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return no("That didn't send. Try again.", 400);
  }
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const name = get("name");
  const company = get("company");
  const phone = get("phone");
  const runs = get("runs");
  // A field people can't see. A bot fills it in; so, now and then, does a
  // phone's autofill. So it isn't thrown away: it's saved, marked, and not
  // emailed, and it shows up in the morning note where a person can tell.
  const trap = Boolean(get("website"));

  if (!name) return no("Add your name, so we know who we're calling.", 400);
  if (!company) return no("Add your company's name.", 400);
  if (phone.replace(/\D/g, "").length < 10) return no("Add a cell number with the area code.", 400);
  if ([name, company, phone, runs].some((f) => f.length > MAX_FIELD)) return no("That's too long. Shorten it and try again.", 413);

  let insertedId: string | null = null;
  let busy = false;
  const admin = getAdminSupabase();
  if (admin) {
    // Somebody leaning on the form shouldn't burn the email this site also needs for password resets and the morning note.
    const { count } = await admin.from("audit_requests").select("id", { count: "exact", head: true })
      .in("source", ["access", "access_trap"]).gte("created_at", new Date(Date.now() - 3600e3).toISOString());
    busy = (count ?? 0) >= EMAILS_AN_HOUR;
    // Past ten times the cap in an hour it's a flood, not leads: stop filling the table.
    if ((count ?? 0) >= EMAILS_AN_HOUR * 10) return no("Too many requests right now. Try again in a little while.", 429);
    const { data, error } = await admin.from("audit_requests").insert({
      name, company, email: "", phone,
      service_type: runs || null,
      bottleneck: "Asked for access to SYNNR from the homepage.",
      source: trap ? "access_trap" : "access",
    } as never).select("id").single();
    if (error) console.error("[access] store failed:", error.message);
    insertedId = (data as { id: string } | null)?.id ?? null;
  }
  const stored = Boolean(insertedId);
  // Caught by the trap or over the hourly cap: saved, and it goes out in the morning note.
  if (stored && (trap || busy)) return yes();
  if (trap) return yes();

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

  if (!stored && !emailed) return no("That didn't save. Call or text 432-250-0715 instead.", 500);
  return yes();
}
