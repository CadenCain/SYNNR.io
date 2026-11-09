import { saasAdmin } from "@/lib/saas/db";
import { loadPublicRecord } from "../load-record";

/**
 * The photo of the loaded truck on a load-out link. Opens only while the
 * link is on, and signs a fresh short link every time, so it still shows on
 * a tab left open past the hour.
 */
export const dynamic = "force-dynamic";

const nope = (status = 404) => new Response(status === 410 ? "The shop shut this link off." : "Not found", { status, headers: { "Cache-Control": "no-store" } });

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = saasAdmin();
  if (!admin) return nope();
  const got = await loadPublicRecord(admin, token);
  if (got === "off") return nope(410);
  if (!got?.rec.photo_path) return nope();
  const { data } = await admin.storage.from("proofs").createSignedUrl(got.rec.photo_path, 300);
  if (!data?.signedUrl) return nope();
  return new Response(null, { status: 302, headers: { Location: data.signedUrl, "Cache-Control": "no-store" } });
}
