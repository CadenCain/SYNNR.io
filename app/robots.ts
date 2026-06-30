import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/app/", "/onboarding", "/op", "/op/", "/api/"],
    },
    sitemap: "https://synnr.io/sitemap.xml",
  };
}
