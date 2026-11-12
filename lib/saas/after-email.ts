import type { SupabaseClient } from "@supabase/supabase-js";
import { afterLines } from "./jobs";
import { escHtml } from "./html";
import { fmtWhen } from "./format";
import { sendEmail } from "./notify";

/**
 * The morning note about what a crew still owes after a job. A truck went
 * out, and what the crew proves when it's back (rams closed for travel, the
 * package washed) has no photo. Each morning a company's managers get that
 * list, so nobody has to drive up to the yard to find out, and a crew that
 * skips the photo is on the list by name of truck. The photo takes a truck
 * off it. SYNNR doesn't know when a truck is back, so a truck still out on
 * its job shows here too; one cleared in the last half day doesn't.
 */
export type OwedJob = { job_id: string; job: string; ready_by: string | null; ready_at: string | null; checks: string[] };

const SITE = "https://www.synnr.io";
/** A truck cleared in the last half day is still on its job. */
export const SETTLE_MS = 12 * 3600e3;
/** A job stops coming up a week after its truck was cleared. */
export const WINDOW_MS = 7 * 86400e3;

/** The email for one company, oldest first. Null when nothing is owed. */
export function afterEmail(company: string, all: OwedJob[]): { subject: string; html: string } | null {
  const jobs = all.filter((j) => j.checks.length).sort((a, b) => (a.ready_at ?? "").localeCompare(b.ready_at ?? ""));
  if (!jobs.length) return null;
  const subject = jobs.length === 1
    ? `No photo after the job: ${jobs[0].job || "one truck"}`
    : `${jobs.length} trucks with no photo after the job`;
  const rows = jobs.map((j) => `<tr><td style="padding:12px 0;border-top:1px solid #ddd">
<a href="${SITE}/app/jobs/${escHtml(j.job_id)}" style="color:#111;font-weight:600">${escHtml(j.job || "A job")}</a><br>
<span style="color:#555">Cleared by ${escHtml(j.ready_by ?? "someone")}, ${escHtml(fmtWhen(j.ready_at, null))}</span><br>
No photo: ${j.checks.map(escHtml).join("; ")}
</td></tr>`).join("");
  const html = `<div style="font:15px/1.55 -apple-system,'Segoe UI',Arial,sans-serif;color:#111;max-width:560px">
<p>After the job, no photo yet at ${escHtml(company)}:</p>
<table style="border-collapse:collapse;width:100%">${rows}</table>
<p>A truck comes off this list when the crew takes the photo. One that's still out on its job shows here until it's back.</p>
<p style="color:#666;font-size:13px">SYNNR sends this each morning, for a week after a truck was cleared.</p>
</div>`;
  return { subject, html };
}

type Row = {
  id: string; company_id: string; truck: string | null; job_type: string; ready_by: string | null; ready_at: string | null;
  synnr_job_lines: { label: string; phase: "load" | "after"; on_at: string | null; sort: number }[] | null;
};

/** Send the morning note to the managers of every real company that's owed a photo. Returns what happened, for the cron's log. */
export async function sendAfterOwed(admin: SupabaseClient, now: number): Promise<{ companies: number; sent: number; errors: string[] }> {
  const errors: string[] = [];
  const { data, error } = await admin.from("synnr_jobs")
    .select("id, company_id, truck, job_type, ready_by, ready_at, synnr_job_lines(label, phase, on_at, sort)")
    .eq("status", "ready").gte("ready_at", new Date(now - WINDOW_MS).toISOString()).lte("ready_at", new Date(now - SETTLE_MS).toISOString()).limit(1000);
  if (error) return { companies: 0, sent: 0, errors: [`jobs: ${error.message}`] };
  const owed = ((data ?? []) as unknown as Row[]).map((j) => ({
    company_id: j.company_id, job_id: j.id, job: [j.truck, j.job_type].filter(Boolean).join(", "), ready_by: j.ready_by, ready_at: j.ready_at,
    checks: afterLines(j.synnr_job_lines ?? []).filter((l) => !l.on_at).sort((a, b) => a.sort - b.sort).map((l) => l.label),
  })).filter((j) => j.checks.length);
  const ids = [...new Set(owed.map((j) => j.company_id))];
  if (!ids.length) return { companies: 0, sent: 0, errors };

  // The demo is open to anyone: nothing is emailed out of it.
  const [{ data: cos }, { data: mems }] = await Promise.all([
    admin.from("saas_companies").select("id, name").in("id", ids).eq("is_demo", false),
    admin.from("saas_memberships").select("company_id, user_id").in("company_id", ids).neq("role", "member").eq("status", "active"),
  ]);
  const companies = (cos ?? []) as { id: string; name: string }[];
  const members = (mems ?? []) as { company_id: string; user_id: string }[];
  let sent = 0;
  for (const co of companies) {
    const mail = afterEmail(co.name, owed.filter((j) => j.company_id === co.id));
    if (!mail) continue;
    const to: string[] = [];
    for (const m of members.filter((x) => x.company_id === co.id)) {
      const { data: who } = await admin.auth.admin.getUserById(m.user_id);
      const email = who?.user?.email;
      // A demo login has no inbox.
      if (email && !/@demo\.synnr\.io$/i.test(email) && !to.includes(email)) to.push(email);
    }
    if (!to.length) continue;
    if (await sendEmail(to, mail.subject, mail.html)) sent += 1;
    else errors.push(`after-the-job email didn't send for company ${co.id}`);
  }
  return { companies: companies.length, sent, errors };
}
