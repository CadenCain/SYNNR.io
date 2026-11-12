import type { SupabaseClient } from "@supabase/supabase-js";
import { daysOut, daysOutText } from "./jobs";
import { escHtml } from "./html";
import { fmtDay } from "./format";
import { sendEmail } from "./notify";

/**
 * The morning note about rented gear. A rented piece left on location bills
 * by the day, and nobody finds out until the invoice. So each morning, every
 * manager at a company with rented gear still out (no photo of it back) gets
 * the list: what, whose, which job, how many days. It stops the day the
 * photo goes in. Gear that went out in the last day isn't in it: that job is
 * probably still running.
 */
export type RentedItem = { label: string; from: string; job: string; job_id: string; since: string | null; days: number };

const SITE = "https://www.synnr.io";

/** The email for one company, longest out first. Null when there's nothing a day old. */
export function rentedEmail(company: string, all: RentedItem[]): { subject: string; html: string } | null {
  const items = all.filter((i) => i.days >= 1).sort((a, b) => b.days - a.days);
  if (!items.length) return null;
  const top = items[0];
  const subject = items.length === 1
    ? `Rented gear still out: ${top.label} from ${top.from}, ${daysOutText(top.days)}`
    : `${items.length} rented pieces still out, the longest ${daysOutText(top.days)}`;
  const cell = "padding:10px 12px 10px 0;border-top:1px solid #ddd;vertical-align:top";
  const rows = items.map((i) => `<tr>
<td style="${cell}"><a href="${SITE}/app/jobs/${escHtml(i.job_id)}" style="color:#111;font-weight:600">${escHtml(i.label)}</a><br><span style="color:#555">Rented from ${escHtml(i.from)}${i.job ? `. ${escHtml(i.job)}` : ""}</span></td>
<td style="${cell};white-space:nowrap;text-align:right"><strong>${escHtml(daysOutText(i.days))}</strong><br><span style="color:#555">since ${escHtml(fmtDay(i.since))}</span></td>
</tr>`).join("");
  const html = `<div style="font:15px/1.55 -apple-system,'Segoe UI',Arial,sans-serif;color:#111;max-width:560px">
<p>Rented gear on ${escHtml(company)} jobs with no photo of it back:</p>
<table style="border-collapse:collapse;width:100%">${rows}</table>
<p>It bills by the day until it goes back. When it's back in the yard or returned, open the job and take the photo, and it comes off this list.</p>
<p style="color:#666;font-size:13px">SYNNR sends this each morning while rented gear is still out.</p>
</div>`;
  return { subject, html };
}

type Row = { label: string; rented_from: string; company_id: string; job_id: string; synnr_jobs: { truck: string | null; job_type: string; ready_at: string | null; created_at: string } | null };

/** Send the morning note to every real company that has rented gear out. Returns what happened, for the cron's log. */
export async function sendRentedOut(admin: SupabaseClient, now: number): Promise<{ companies: number; sent: number; errors: string[] }> {
  const errors: string[] = [];
  const { data, error } = await admin.from("synnr_job_lines")
    .select("label, rented_from, company_id, job_id, synnr_jobs(truck, job_type, ready_at, created_at)")
    .eq("phase", "after").not("rented_from", "is", null).is("on_at", null).limit(1000);
  if (error) return { companies: 0, sent: 0, errors: [`rented lines: ${error.message}`] };
  const rows = (data ?? []) as unknown as Row[];
  const ids = [...new Set(rows.map((r) => r.company_id))];
  if (!ids.length) return { companies: 0, sent: 0, errors };

  // The demo is open to anyone: nothing is emailed out of it.
  const [{ data: cos }, { data: mems }] = await Promise.all([
    admin.from("saas_companies").select("id, name").in("id", ids).eq("is_demo", false),
    admin.from("saas_memberships").select("company_id, user_id").in("company_id", ids).neq("role", "member").eq("status", "active"),
  ]);
  const members = (mems ?? []) as { company_id: string; user_id: string }[];
  let sent = 0;
  const companies = (cos ?? []) as { id: string; name: string }[];
  for (const co of companies) {
    const items = rows.filter((r) => r.company_id === co.id).map((r) => {
      const since = r.synnr_jobs?.ready_at ?? r.synnr_jobs?.created_at ?? null;
      return { label: r.label, from: r.rented_from, job_id: r.job_id, since, days: daysOut(since, now), job: [r.synnr_jobs?.truck, r.synnr_jobs?.job_type].filter(Boolean).join(", ") };
    });
    const mail = rentedEmail(co.name, items);
    if (!mail) continue;
    const to: string[] = [];
    for (const m of members.filter((x) => x.company_id === co.id)) {
      const { data: who } = await admin.auth.admin.getUserById(m.user_id);
      const email = who?.user?.email;
      // Demo and placeholder logins have no inbox.
      if (email && !/@(example\.com|demo\.synnr\.io)$/i.test(email) && !to.includes(email)) to.push(email);
    }
    if (!to.length) continue;
    if (await sendEmail(to, mail.subject, mail.html)) sent += 1;
    else errors.push(`rented email didn't send for company ${co.id}`);
  }
  return { companies: companies.length, sent, errors };
}
