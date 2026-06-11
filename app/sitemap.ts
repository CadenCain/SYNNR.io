import type { MetadataRoute } from "next";
import { GLOSSARY } from "@/lib/content/glossary";

const BASE = "https://synnr.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["/", "/onboarding", "/checkout", "/login", "/legal/terms", "/legal/privacy", "/glossary"];
  return [
    ...pages.map((p) => ({
      url: BASE + p,
      changeFrequency: "weekly" as const,
      priority: p === "/" ? 1 : 0.6,
    })),
    ...GLOSSARY.map((t) => ({
      url: `${BASE}/glossary/${t.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
