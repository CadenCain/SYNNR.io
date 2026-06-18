import type { MetadataRoute } from "next";

/** PWA manifest — lets a crew install TallyShot to the home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TallyShot — SYNNR",
    short_name: "TallyShot",
    description:
      "Photograph a handwritten tally sheet, get clean Excel back — every shaky digit flagged for a human to confirm.",
    start_url: "/app/tallyshot",
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
