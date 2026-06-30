import type { NextConfig } from "next";

// The old SaaS marketplace / gated-app surface is PARKED, not deleted: the page
// code stays in the repo (may be reused), but every old route is made
// unreachable here — it 307s to home so no stale marketplace/app/login/checkout
// page is ever served. Re-enable by removing the matching entry.
const PARKED = [
  "/dashboard",
  "/app/:path*",
  "/apps",
  "/apps/:path*",
  "/checkout",
  "/billing",
  "/team",
  "/account",
  "/ingest",
  "/demo",
  "/login",
  "/signup",
];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Old funnel URLs land directly on the live one (single hop — no chains).
      { source: "/readiness-map", destination: "/readiness-audit", permanent: false },
      { source: "/services", destination: "/readiness-audit", permanent: false },
      // Park old SaaS marketplace/app/auth routes.
      ...PARKED.map((source) => ({ source, destination: "/", permanent: false })),
    ];
  },
};

export default nextConfig;
