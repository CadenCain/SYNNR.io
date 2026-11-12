import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Proof photos for a job. Each critical piece gets one, taken when it goes
 * on the truck. They live in the private "proofs" bucket under the company's
 * own folder, so only that company can ever be shown them:
 *   <company>/jobs/<job>/<line>-<when>.jpg
 * Every photo gets its own file name. A retake never writes over the photo
 * it replaces, so if the retake fails to save, the first one is still there,
 * and taking a piece off can't delete a photo taken a moment later.
 * Only the server reads or writes this bucket (the storage rules refuse
 * anyone else). A person sees a photo through a short-lived link made after
 * the database has confirmed they can see the job.
 */
export const PROOFS = "proofs";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const PHOTO_TYPES = Object.keys(EXT);

export const photoPath = (companyId: string, jobId: string, lineId: string, mime: string, when: number) =>
  `${companyId}/jobs/${jobId}/${lineId}-${Math.trunc(when).toString(36)}.${EXT[mime] ?? "jpg"}`;

/** The smallest file that could be a real photo. A phone photo, even shrunk, is tens of thousands of bytes. */
export const MIN_PHOTO_BYTES = 2048;

/**
 * Whether these bytes really are the kind of picture they say they are. The
 * type a phone sends with an upload is just a label; the first few bytes of
 * a JPEG, PNG or WebP can't be faked without it being one.
 */
export function isPhoto(bytes: Uint8Array, mime: string): boolean {
  if (bytes.length < MIN_PHOTO_BYTES) return false;
  const at = (i: number, ...want: number[]) => want.every((b, k) => bytes[i + k] === b);
  if (mime === "image/jpeg") return at(0, 0xff, 0xd8, 0xff);
  if (mime === "image/png") return at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (mime === "image/webp") return at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50);
  return false;
}

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
