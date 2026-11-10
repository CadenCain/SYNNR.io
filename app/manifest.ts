import type { MetadataRoute } from "next";

/** PWA manifest: puts SYNNR on the home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SYNNR",
    short_name: "SYNNR",
    description: "Ask anything about your company: prices, tickets, trucks, tools, and jobs.",
    start_url: "/app",
    display: "standalone",
    background_color: "#08090a",
    theme_color: "#08090a",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
