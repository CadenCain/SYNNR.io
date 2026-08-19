import type { Instrumentation } from "next";

/**
 * Server-side error monitoring — the "Sentry or equivalent" with no external
 * account required. Next calls onRequestError for every uncaught server error
 * (Server Components, actions, route handlers). We do two things:
 *
 *   1. console.error a structured line — Vercel captures these in runtime
 *      logs, searchable and retained.
 *   2. Email the operator, throttled to one email per error signature per
 *      hour PER SERVERLESS INSTANCE. The throttle is in-memory on purpose:
 *      a shared store would add a dependency to the error path itself, and
 *      the worst case of instance-local throttling is a few duplicate emails
 *      during a storm — vs. an inbox flood with no throttle at all.
 *
 * Upgrade path when there's real traffic: `npx @sentry/wizard@latest -i nextjs`
 * and delete the email block — this hook is exactly where Sentry plugs in.
 */

const lastSent = new Map<string, number>();
const THROTTLE_MS = 60 * 60 * 1000;

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = err as { message?: string; stack?: string; digest?: string };
  const signature = `${e.digest ?? ""}|${(e.message ?? "unknown").slice(0, 120)}|${request.path}`;

  console.error("[server-error]", JSON.stringify({
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routeType: context.routeType,
    digest: e.digest ?? null,
    message: e.message ?? String(err),
  }));

  // Never let the reporter take down the request path it's reporting on.
  try {
    const key = process.env.RESEND_API_KEY;
    const to = process.env.NOTIFY_EMAIL;
    if (!key || !to || process.env.NODE_ENV !== "production") return;

    const now = Date.now();
    const last = lastSent.get(signature) ?? 0;
    if (now - last < THROTTLE_MS) return;
    lastSent.set(signature, now);
    // cap the map so a pathological error variety storm can't grow memory
    if (lastSent.size > 200) lastSent.clear();

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.ALERTS_FROM_EMAIL || "RollReady Alerts <alerts@synnr.io>",
        to: [to],
        subject: `[SYNNR ops] server error — ${request.method} ${request.path}`,
        html: `<pre style="font:13px/1.6 monospace;white-space:pre-wrap">${
          [
            `path:    ${request.method} ${request.path}`,
            `route:   ${context.routerKind} / ${context.routeType}`,
            `digest:  ${e.digest ?? "(none)"}`,
            ``,
            (e.message ?? String(err)).slice(0, 500),
            ``,
            (e.stack ?? "").split("\n").slice(0, 12).join("\n"),
            ``,
            `Throttled: at most one email per error per hour per instance.`,
            `Full logs: Vercel → synnr-io → Logs, search [server-error].`,
          ].join("\n")
        }</pre>`,
      }),
    });
  } catch {
    // reporting failed — the console.error above is still in Vercel logs
  }
};
