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
  // The cert reader (tesseract) runs in Node with a worker thread and wasm;
  // it has to load from node_modules as-is, not bundled.
  serverExternalPackages: ["tesseract.js", "tesseract.js-core"],
  // Only the upload route reads photos, so only it carries the reader, its
  // wasm, and the English model (lib/saas/ocr-data).
  outputFileTracingIncludes: {
    "/api/saas/certs/upload": [
      "./lib/saas/ocr-data/**",
      "./node_modules/tesseract.js/**",
      "./node_modules/tesseract.js-core/**",
      // The reader's worker thread loads these itself, so the tracer can't
      // see them. Without them the worker dies on start.
      "./node_modules/wasm-feature-detect/**",
      "./node_modules/bmp-js/**",
      "./node_modules/zlibjs/**",
      "./node_modules/is-url/**",
      "./node_modules/regenerator-runtime/**",
      "./node_modules/node-fetch/**",
      "./node_modules/whatwg-url/**",
      "./node_modules/tr46/**",
      "./node_modules/webidl-conversions/**",
    ],
  },
  experimental: {
    // Phones shrink photos before sending (about 0.5MB), but a server action
    // carrying an older photo form shouldn't die at the 1MB default. Vercel
    // caps a request at 4.5MB, so 4MB is the real ceiling.
    serverActions: { bodySizeLimit: "4mb" },
  },
  async redirects() {
    return [
      // Old funnel URLs land directly on the live one (single hop — no chains).
      { source: "/readiness-map", destination: "/readiness-audit", permanent: false },
      { source: "/services", destination: "/readiness-audit", permanent: false },
      // The four-tool product pages (Roll / Cards / Yard / Proof) are gone:
      // SYNNR sells one thing now. Old shared links land on the homepage's
      // product section instead of a 404.
      { source: "/products", destination: "/#product", permanent: false },
      { source: "/products/:slug*", destination: "/#product", permanent: false },
      // Park old SaaS marketplace/app/auth routes.
      ...PARKED.map((source) => ({ source, destination: "/", permanent: false })),
    ];
  },
};

export default nextConfig;
