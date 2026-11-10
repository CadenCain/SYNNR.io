import { NextResponse } from "next/server";
import { safeNext } from "@/lib/saas/safe-next";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Emailed links with a token the server checks itself (password reset, from
 * lib/saas/password-reset.ts). Unlike /auth/callback, nothing has to be saved
 * in the browser beforehand, so the link works on any phone or browser.
 *
 * Opening the link (GET) only shows a button. The token is used when the
 * person taps it (POST): work email often opens every link to scan it first,
 * and a link that signed you in on open would be used up before you ever saw
 * it. A used or expired link lands on /forgot to ask for a new one.
 */
export const dynamic = "force-dynamic";

const TYPES: EmailOtpType[] = ["recovery", "magiclink", "email", "signup", "invite", "email_change"];
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash") ?? "";
  const type = url.searchParams.get("type") ?? "";
  const next = safeNext(url.searchParams.get("next"), "/app");
  if (!tokenHash || !TYPES.includes(type as EmailOtpType)) return NextResponse.redirect(new URL("/forgot?expired=1", url.origin));
  const label = type === "recovery" ? "Set a new password" : "Continue";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${label} · SYNNR</title>
<style>
:root{color-scheme:dark;--bg:#08090a;--card:#0e0f11;--ink:#ededef;--dim:#a1a4aa;--line:#1d1f23}
body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--ink);font:16px/1.5 -apple-system,Segoe UI,sans-serif;padding:16px}
.card{width:100%;max-width:380px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:28px}
h1{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:600;letter-spacing:.16em;margin:0 0 14px}h1 svg{width:18px;height:18px;fill:#ff5a1f}p{color:var(--dim);margin:0 0 18px;font-size:15px}
button{width:100%;min-height:44px;border:0;border-radius:8px;background:#ededef;color:#08090a;font:500 15px -apple-system,Segoe UI,sans-serif;cursor:pointer}button:hover{background:#fff}
</style></head><body><form class="card" method="post" action="/auth/confirm">
<h1><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 3H30L28.2 9H12L25.4 18L22 29H2L3.8 23H20L6.6 14Z"/></svg>SYNNR</h1><p>Tap the button to ${type === "recovery" ? "set a new password for your login" : "keep going"}. The link works once.</p>
<input type="hidden" name="token_hash" value="${esc(tokenHash)}"><input type="hidden" name="type" value="${esc(type)}"><input type="hidden" name="next" value="${esc(next)}">
<button type="submit">${label}</button></form></body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const fd = await req.formData().catch(() => null);
  const tokenHash = String(fd?.get("token_hash") ?? "");
  const type = String(fd?.get("type") ?? "") as EmailOtpType;
  const next = safeNext(fd?.get("next"), "/app");
  if (tokenHash && TYPES.includes(type)) {
    const supabase = await getServerSupabase();
    if (supabase) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) return NextResponse.redirect(new URL(next, url.origin), 303);
    }
  }
  return NextResponse.redirect(new URL("/forgot?expired=1", url.origin), 303);
}
