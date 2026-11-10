import type { MetadataRoute } from "next";

// www is the primary host in Vercel (apex 308s to it): the sitemap must list
// the canonical serving host, not a redirect.
const BASE = "https://www.synnr.io";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/legal/terms", "/legal/privacy"].map((p) => ({
    url: BASE + p,
    changeFrequency: p === "/" ? ("weekly" as const) : ("monthly" as const),
    priority: p === "/" ? 1 : 0.3,
  }));
}
