"use server";

import { saasAdmin } from "@/lib/saas/db";
import { sendPasswordReset, safeNext } from "@/lib/saas/password-reset";

/** Email a reset link. Always answers the same, so nobody can tell which emails have a login. */
export async function requestReset(email: string, next?: string): Promise<{ ok: true }> {
  const admin = saasAdmin();
  if (admin) {
    const r = await sendPasswordReset(admin, String(email ?? "").slice(0, 254), safeNext(next));
    if (r === "failed") console.error("[reset] email didn't send");
  }
  return { ok: true };
}
