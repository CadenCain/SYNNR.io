import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/app/", "/apps", "/checkout", "/billing", "/team", "/account", "/ingest", "/demo", "/login", "/signup", "/api/"],
    },
    sitemap: "https://synnr.io/sitemap.xml",
  };
}
