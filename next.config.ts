import type { NextConfig } from "next";

// Leftover dead-marketplace routes still in the tree (app/apps, app/checkout,
// app/ingest) are parked — they 307 to home so no stale page is served. The
// self-serve SaaS now OWNS /login, /signup, /app/**, and (2026-08-21) /demo —
// the live drive-it-yourself demo replaced the parked marketplace stub.
// /dashboard, /billing, /team, /account were relocated; kept parked here so
// stray hits to those old URLs still land on home.
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
