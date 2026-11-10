import type { MetadataRoute } from "next";

// www is the primary host in Vercel (apex 308s to it): the sitemap must list
// the canonical serving host, not a redirect.
const BASE = "https://www.synnr.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [string, number][] = [["/", 1], ["/product", 0.8], ["/security", 0.6], ["/legal/terms", 0.3], ["/legal/privacy", 0.3]];
  return pages.map(([p, priority]) => ({ url: BASE + p, changeFrequency: p.startsWith("/legal") ? ("monthly" as const) : ("weekly" as const), priority }));
}
