/* RollReady offline: a load-out or a check-in keeps working with no signal.
 *
 * The back of a yard often has no signal. This keeps the Load out board,
 * every truck's load-out scan page, and every check-in page on the phone, so
 * a hand can load a truck out or check iron in with no signal. Scans are kept on the phone by the page
 * itself and sent when signal comes back; the server checks every piece
 * again when they arrive, so an old copy of a page can't make a truck READY.
 *
 *   Pages (/app, /app/return, /app/units/<id>/scan and /return): network
 *   first, the saved copy when there's no signal. The Load out board asks
 *   for every truck's pages to be saved ahead of time ("warm").
 *   Built files (/_next/static): saved the first time, they never change.
 *   Signing in or out throws the saved pages away.
 * Nothing outside /app is touched.
 */
const PAGES = "rr-pages-v1";
const STATIC = "rr-static-v1";
const KEEP = [PAGES, STATIC];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (!KEEP.includes(k)) await caches.delete(k);
    await trimStatic();
    await self.clients.claim();
  })());
});

const savable = (url) => url.pathname === "/app" || url.pathname === "/app/return" || /^\/app\/units\/[^/]+\/(scan|return)$/.test(url.pathname);
const keyOf = (url) => url.origin + url.pathname;
const authPath = (p) => ["/login", "/logout", "/signup", "/auth", "/invite", "/demo", "/onboarding"].some((x) => p.startsWith(x));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (authPath(url.pathname)) { event.waitUntil(caches.delete(PAGES)); return; }
  if (url.pathname.startsWith("/_next/static/")) { event.respondWith(cacheFirst(req)); return; }
  if (req.mode === "navigate" && url.pathname.startsWith("/app")) event.respondWith(page(req, url));
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function page(req, url) {
  try {
    const res = await fetch(req);
    if (res.redirected && authPath(new URL(res.url).pathname)) await caches.delete(PAGES);
    else if (res.ok && !res.redirected && savable(url)) await (await caches.open(PAGES)).put(keyOf(url), res.clone());
    return res;
  } catch {
    const hit = await (await caches.open(PAGES)).match(keyOf(url));
    return hit || offline();
  }
}

function offline() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>No signal · RollReady</title><style>body{margin:0;font:16px/1.5 -apple-system,system-ui,sans-serif;background:#f6f7f9;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
main{max-width:420px;background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:24px}h1{font-size:20px;margin:0 0 8px}a{display:inline-flex;margin-top:16px;height:48px;align-items:center;padding:0 20px;border-radius:8px;background:#1d4ed8;color:#fff;text-decoration:none;font-weight:600}</style></head>
<body><main><h1>No signal</h1><p>This page isn't saved on this phone yet. Open the Load out screen once while you have signal, and every truck's load-out works without signal after that.</p><a href="/app">Go to Load out</a></main></body></html>`;
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// The Load out board sends every truck's scan page to save ahead of time,
// with the built files each one needs.
self.addEventListener("message", (event) => {
  const d = event.data || {};
  if (d.type === "warm" && Array.isArray(d.urls)) event.waitUntil(warm(d.urls.slice(0, 60)));
  if (d.type === "forget") event.waitUntil(caches.delete(PAGES));
});

async function warm(urls) {
  const pages = await caches.open(PAGES);
  const stat = await caches.open(STATIC);
  const files = new Set();
  for (const u of urls) {
    const url = new URL(u, self.location.origin);
    if (url.origin !== self.location.origin || !savable(url)) continue;
    let res;
    try { res = await fetch(url.href, { credentials: "same-origin", headers: { Accept: "text/html" } }); } catch { return; }
    if (!res.ok || res.redirected) { if (res.redirected) await caches.delete(PAGES); return; }
    const html = await res.clone().text();
    await pages.put(keyOf(url), res);
    for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) files.add(m[1]);
  }
  for (const f of files) {
    if (await stat.match(f)) continue;
    try { const r = await fetch(f); if (r.ok) await stat.put(f, r); } catch { return; }
  }
  await trimStatic();
}

/** Built files from old deploys pile up; keep the newest 400. */
async function trimStatic() {
  const cache = await caches.open(STATIC);
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - 400))) await cache.delete(k);
}
