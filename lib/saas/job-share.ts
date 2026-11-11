import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signPhotos } from "./job-photos";
import { firstName, sharedLines, type JobDetails, type JobLine, type SharedLine } from "./jobs";

/**
 * The link a crew sends the customer. It opens one job, with no login: the
 * list, what's on the truck, and the photo of each critical piece. The link
 * is a long random token, so it can't be guessed, and a manager can turn it
 * off. Server only: this file makes tokens and reads with the server's key.
 */
export const SHARE_TOKEN = /^[A-Za-z0-9_-]{24,64}$/;

/** 144 random bits, safe in a URL. */
export const newShareToken = () => randomBytes(18).toString("base64url");

/** Everything a customer is shown. Nothing here says where a photo is kept or who else is on the crew. */
export type SharedJob = {
  company: string;
  job_type: string;
  truck: string | null;
  well: string | null;
  start: string | null;
  status: "loading" | "ready";
  ready_by: string | null;
  ready_at: string | null;
  lines: SharedLine[];
};

type Row = {
  id: string; job_type: string; truck: string | null; details: JobDetails | null; status: "loading" | "ready";
  ready_by: string | null; ready_at: string | null; company: { name: string; is_demo: boolean } | null;
};

/** The job behind a link, or null when the link is wrong, off, or the job is gone. */
export async function getSharedJob(admin: SupabaseClient, token: string): Promise<SharedJob | null> {
  if (!SHARE_TOKEN.test(token)) return null;
  const { data } = await admin.from("synnr_jobs")
    .select("id, job_type, truck, details, status, ready_by, ready_at, company:saas_companies(name, is_demo)")
    .eq("share_token", token).maybeSingle();
  const job = data as Row | null;
  // The demo company is open to anyone, so it never gets a public page.
  if (!job || !job.company || job.company.is_demo) return null;

  const { data: rows } = await admin.from("synnr_job_lines")
    .select("id, label, qty, critical, why, source, sort, on_by, on_at, photo_path").eq("job_id", job.id).order("sort").limit(500);
  const lines = (rows ?? []) as JobLine[];
  const signed = await signPhotos(admin, lines.map((l) => l.photo_path).filter((p): p is string => Boolean(p)));

  return {
    company: job.company.name,
    job_type: job.job_type,
    truck: job.truck,
    well: job.details?.well ?? null,
    start: job.details?.start ?? null,
    status: job.status,
    ready_by: job.status === "ready" ? firstName(job.ready_by) : null,
    ready_at: job.ready_at,
    lines: sharedLines(lines, (path) => signed.get(path)),
  };
}
