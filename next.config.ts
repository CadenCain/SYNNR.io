import type { NextConfig } from "next";

// Leftover dead-marketplace routes still in the tree (app/apps, app/checkout,
// app/ingest, app/demo) are parked — they 307 to home so no stale page is
// served. The self-serve SaaS now OWNS /login, /signup, and /app/** (the old
// versions were relocated to legacy/ out of the route tree), so those are no
// longer parked. /dashboard, /billing, /team, /account were also relocated;
// kept parked here so stray hits to those old URLs still land on home.
const PARKED = [
  "/dashboard",
  "/apps",
  "/apps/:path*",
  "/checkout",
  "/billing",
  "/team",
  "/account",
  "/ingest",
  "/demo",
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
