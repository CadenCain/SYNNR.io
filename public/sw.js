/* RollReady offline: a load-out or a check-in keeps working with no signal.
 *
 * The back of a yard often has no signal. This keeps the Load out board,
 * every truck's load-out scan page, and every check-in page on the phone, so
 * a hand can load a truck out or check iron in with no signal. Scans are kept on the phone by the page
 * itself and sent when signal comes back; the server checks every piece
 * again when they arrive, so an old copy of a page can't make a truck READY.
 *
 *   Pages (/app, /app/return, /app/units/<id>/scan and /return): network
 *   first, the saved copy when there's no signal, or when one bar hasn't
 *   answered in 5 seconds (the network answer still saves for next time).
 *   A saved copy is marked (<meta name="rr-saved">) so the page always says
 *   it's the copy on this phone and when it was saved, and gets the latest
 *   once it can (app/app/_components/offline-support.tsx). An old board or
 *   scan page never passes for the live one.
 *   The Load out board asks for every truck's pages to be saved ahead of
 *   time ("warm").
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
  if (req.mode === "navigate" && url.pathname.startsWith("/app")) event.respondWith(page(event, req, url));
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

/** One bar that shows signal but moves no data: this long, then the saved copy. */
const SLOW_MS = 5000;

/** A fresh page replaces the saved copy; signed out, every saved page goes. */
async function keep(url, res) {
  // A saved page only ever redirects to signing in or signing up. That can
  // come back after the saved copy already showed, so it's caught here too.
  const signedOut = res.redirected ? authPath(new URL(res.url).pathname) : res.type === "opaqueredirect" && savable(url);
  if (signedOut) await caches.delete(PAGES);
  else if (res.ok && !res.redirected && savable(url)) await (await caches.open(PAGES)).put(keyOf(url), res);
}

async function page(event, req, url) {
  const net = fetch(req);
  // Whenever the network answers, even after the saved copy showed, keep it.
  event.waitUntil(net.then((res) => keep(url, res.clone())).catch(() => {}));
  const saved = caches.open(PAGES).then((c) => c.match(keyOf(url))).catch(() => undefined);
  let timer;
  const slow = new Promise((resolve) => { timer = setTimeout(resolve, SLOW_MS); });
  try {
    // Nothing saved for this page: wait on the network as long as it takes.
    // A saved copy that can't be marked isn't shown with signal: wait instead.
    return await Promise.race([net, slow.then(() => saved).then(async (hit) => (hit && (await marked(hit, url))) || net)]);
  } catch {
    const hit = await saved;
    return hit ? (await marked(hit, url)) || hit : offline();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The saved copy, marked as one: when the server made it (its Date header)
 * and for which page. The page reads the mark and says so on screen, even
 * with signal, so last night's board never passes for this morning's.
 */
async function marked(hit, url) {
  try {
    const at = Date.parse(hit.headers.get("date") || "");
    const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const mark = `<meta name="rr-saved" content="${Number.isFinite(at) ? at : ""}" data-path="${esc(url.pathname)}">`;
    const html = await hit.clone().text();
    const head = /<head(\s[^>]*)?>/i;
    const body = head.test(html) ? html.replace(head, (m) => m + mark) : html + mark;
    const headers = new Headers(hit.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    return new Response(body, { status: hit.status, statusText: hit.statusText, headers });
  } catch {
    return null;
  }
}

function offline() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>No signal · RollReady</title><style>body{margin:0;font:16px/1.5 -apple-system,system-ui,sans-serif;background:#f6f7f9;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
main{max-width:420px;background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:24px}h1{font-size:20px;margin:0 0 8px}a{display:inline-flex;margin-top:16px;height:48px;align-items:center;padding:0 20px;border-radius:8px;background:#1d4ed8;color:#fff;text-decoration:none;font-weight:600}</style></head>
<body><main><h1>No signal</h1><p>This page isn't saved on this phone. With no signal you can still open Load out, each truck's load-out and check-in, and Check in tools or loose iron.</p><p>They're saved each time this phone opens Load out with signal.</p><a href="/app">Go to Load out</a></main></body></html>`;
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// The Load out board sends every truck's scan page to save ahead of time,
// with the built files each one needs.
self.addEventListener("message", (event) => {
  const d = event.data || {};
  if (d.type === "warm" && Array.isArray(d.urls)) event.waitUntil(warm(d.urls.slice(0, 160)));
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
