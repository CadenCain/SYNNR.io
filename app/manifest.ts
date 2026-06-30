import type { MetadataRoute } from "next";

/** PWA manifest — installs SYNNR to the home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SYNNR",
    short_name: "SYNNR",
    description:
      "Equipment & cert readiness for oilfield service shops. Track every asset and cert; get a text before anything expires.",
    start_url: "/app",
    display: "standalone",
    background_color: "#131110",
    theme_color: "#131110",
    orientation: "portrait",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
