export const OFFLINE = "That didn't send. Check your signal and try again.";

/** Run a save. A dropped signal comes back as a plain message here instead of taking the whole screen down. */
export async function safe<T extends { ok: true }>(run: () => Promise<T | { ok: false; error: string }>): Promise<T | { ok: false; error: string }> {
  try {
    return await run();
  } catch (e) {
    // The framework's own signals (a redirect to log in again) pass through.
    if (typeof (e as { digest?: unknown })?.digest === "string" && (e as { digest: string }).digest.startsWith("NEXT_")) throw e;
    return { ok: false, error: OFFLINE };
  }
}
