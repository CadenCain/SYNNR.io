"use client";

import { Analytics } from "@vercel/analytics/next";

/**
 * Page views for the site. A customer's link and a crew invite carry a token
 * in the address, and a token is a key: it's blanked before anything is sent
 * off this site.
 */
export function SiteAnalytics() {
  return <Analytics beforeSend={(e) => ({ ...e, url: e.url.replace(/\/(p|invite)\/[^/?#]+/, "/$1/link") })} />;
}
