import type { NextConfig } from "next";

// Old marketplace-era URLs (/dashboard, /billing, /team, /account and the
// rest) that still get the odd stray hit: they land on home.
const PARKED = [
  "/dashboard",
  "/apps",
  "/apps/:path*",
  "/checkout",
  "/billing",
  "/team",
  "/account",
  "/ingest",
];

const nextConfig: NextConfig = {
  // Off so headless-Chrome captures of the real UI ship clean.
  devIndicators: false,
  outputFileTracingIncludes: {
    // New demo companies are seeded from these files when one is opened.
    "/demo/start": ["./lib/saas/demo-assets/**"],
  },
  async headers() {
    return [
      // Every page: don't let another site frame SYNNR, don't guess file
      // types, don't hand full addresses (a customer's link, a job) to
      // other sites, and no microphone or location. The camera stays: the
      // crew's proof photos use it.
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      // A customer's link and a crew invite never belong in a search result.
      ...["/p/:path*", "/invite/:path*"].map((source) => ({ source, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] })),
      // public/sw.js (now the one that uninstalls the old offline worker) must
      // never be cached by the browser or a CDN, or it would take days to reach phones.
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // RollReady's public pages are gone. Old links land on the homepage
      // instead of a 404 (single hop, no chains).
      ...["/demo", "/glossary", "/glossary/:slug*", "/readiness-audit", "/readiness-map", "/services", "/onepager",
        "/products", "/products/:slug*", "/partners", "/build"]
        .map((source) => ({ source, destination: "/", permanent: false })),
      // Park old SaaS marketplace/app/auth routes.
      ...PARKED.map((source) => ({ source, destination: "/", permanent: false })),
    ];
  },
};

export default nextConfig;
