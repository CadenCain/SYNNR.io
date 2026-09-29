/* Retired. SYNNR used to register a service worker left over from an older
 * product. This version clears its caches and unregisters itself so any
 * phone that still has the old one gets a clean, always-online site. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((c) => c.navigate(c.url))),
  );
});
