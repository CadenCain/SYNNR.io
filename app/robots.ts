import type { MetadataRoute } from "next";

/**
 * What crawlers stay out of. "$" pins the end of the address: a bare "/op"
 * also matched /opengraph-image (the picture that shows when a link to the
 * site is shared) and a bare "/app" matched /apple-icon. A customer's link
 * (/p/...) and a crew invite (/invite/...) aren't listed here on purpose:
 * each page says "don't index me" itself, and a crawler has to be allowed
 * to open the page to read that.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app$", "/app/", "/onboarding", "/op$", "/op/", "/api/", "/demo/"],
    },
    sitemap: "https://www.synnr.io/sitemap.xml",
  };
}
