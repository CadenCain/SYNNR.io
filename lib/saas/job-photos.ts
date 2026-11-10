import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Proof photos for a job. Each critical piece gets one, taken when it goes
 * on the truck. They live in the private "proofs" bucket under the company's
 * own folder, one per line, so only that company can ever be shown them:
 *   <company>/jobs/<job>/<line>.jpg
 * Only the server reads or writes this bucket. A person sees a photo through
 * a short-lived link made after the database has confirmed they can see the job.
 */
export const PROOFS = "proofs";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const PHOTO_TYPES = Object.keys(EXT);

export const photoPath = (companyId: string, jobId: string, lineId: string, mime: string) =>
  `${companyId}/jobs/${jobId}/${lineId}.${EXT[mime] ?? "jpg"}`;

/** Links to open the photos, good for an hour. A path that fails to sign is just left out. */
export async function signPhotos(admin: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const { data } = await admin.storage.from(PROOFS).createSignedUrls(paths, 3600);
  for (const row of data ?? []) if (row.signedUrl && row.path) out.set(row.path, row.signedUrl);
  return out;
}

/** Throw photos away (a piece came back off, or its line was removed). Never throws. */
export async function removePhotos(admin: SupabaseClient | null, paths: (string | null | undefined)[]): Promise<void> {
  const real = paths.filter((p): p is string => Boolean(p));
  if (!admin || !real.length) return;
  await admin.storage.from(PROOFS).remove(real).then(() => {}, () => {});
}

/** Every photo a job has, when the job itself is deleted. */
export async function removeJobPhotos(admin: SupabaseClient | null, companyId: string, jobId: string): Promise<void> {
  if (!admin) return;
  const folder = `${companyId}/jobs/${jobId}`;
  const { data } = await admin.storage.from(PROOFS).list(folder, { limit: 1000 });
  await removePhotos(admin, (data ?? []).map((f) => `${folder}/${f.name}`));
}
