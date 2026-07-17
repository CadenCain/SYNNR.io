import type { MetadataRoute } from "next";
import { GLOSSARY } from "@/lib/content/glossary";

// www is the primary host in Vercel (apex 308s to it) — sitemap must list the
// canonical serving host, not a redirect.
const BASE = "https://www.synnr.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["/", "/partners", "/build", "/readiness-audit", "/legal/terms", "/legal/privacy", "/glossary"];
  return [
    ...pages.map((p) => ({
      url: BASE + p,
      changeFrequency: "weekly" as const,
      priority: p === "/" ? 1 : p === "/partners" || p === "/build" ? 0.8 : 0.6,
    })),
    ...GLOSSARY.map((t) => ({
      url: `${BASE}/glossary/${t.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
