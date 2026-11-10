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
    // New demo companies are seeded from these files, at open and on the daily refresh.
    "/demo/start": ["./lib/saas/demo-assets/**"],
    "/api/cron/daily": ["./lib/saas/demo-assets/**"],
  },
  experimental: {
    // Phones shrink photos before sending (about 0.5MB), but a server action
    // carrying an older photo form shouldn't die at the 1MB default. Vercel
    // caps a request at 4.5MB, so 4MB is the real ceiling.
    serverActions: { bodySizeLimit: "4mb" },
  },
  // public/sw.js (now the one that uninstalls the old offline worker) must
  // never be cached by the browser or a CDN, or it would take days to reach phones.
  async headers() {
    return [
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
