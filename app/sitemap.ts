import type { MetadataRoute } from "next";

const BASE = "https://synnr.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["/", "/onboarding", "/checkout", "/login", "/legal/terms", "/legal/privacy"];
  return pages.map((p) => ({
    url: BASE + p,
    changeFrequency: "weekly",
    priority: p === "/" ? 1 : 0.6,
  }));
}
