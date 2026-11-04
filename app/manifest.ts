import type { MetadataRoute } from "next";

/** PWA manifest: installs RollReady to the home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RollReady by SYNNR",
    short_name: "RollReady",
    description:
      "Load-out checks for oilfield service yards. Nothing rolls without proof: every piece on the list, in test, and backed by its cert.",
    start_url: "/app",
    display: "standalone",
    background_color: "#090c11",
    theme_color: "#090c11",
    orientation: "portrait",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
