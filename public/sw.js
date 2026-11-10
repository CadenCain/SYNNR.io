/* Retired. RollReady's offline worker kept copies of its app pages on the
 * phone. SYNNR doesn't, so this version throws every saved copy away and
 * uninstalls itself; any open page reloads fresh from the network. It has
 * no fetch handler, so nothing is ever served from a cache again.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: "window" })) c.navigate(c.url).catch(() => {});
  })());
});
