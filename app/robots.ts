import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/app/", "/billing", "/team", "/account", "/api/"],
    },
    sitemap: "https://synnr.io/sitemap.xml",
  };
}
