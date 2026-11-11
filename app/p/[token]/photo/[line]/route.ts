import { NextResponse } from "next/server";
import { saasAdmin } from "@/lib/saas/db";
import { PROOFS } from "@/lib/saas/job-photos";
import { sharedPhotoPath } from "@/lib/saas/job-share";

/**
 * One proof photo, for whoever holds a job's link. It is served from here,
 * under the link itself, so it works exactly as long as the link does: a
 * manager turns the link off and the photos are gone with the page. Nothing
 * in the address or the answer says where the photo is kept.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
// Never kept by a browser or anything in between, and never in a search engine.
const QUIET = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(_req: Request, { params }: { params: Promise<{ token: string; line: string }> }) {
  const gone = () => new NextResponse("Not found", { status: 404, headers: QUIET });
  const { token, line } = await params;
  const admin = saasAdmin();
  if (!admin) return gone();
  const path = await sharedPhotoPath(admin, token, line);
  if (!path) return gone();
  const type = TYPES[path.split(".").pop() ?? ""];
  if (!type) return gone();
  const { data, error } = await admin.storage.from(PROOFS).download(path);
  if (error || !data) return gone();
  return new NextResponse(data, {
    headers: { ...QUIET, "Content-Type": type, "Content-Length": String(data.size), "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" },
  });
}
