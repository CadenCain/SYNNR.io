import { ImageResponse } from "next/og";

export const alt = "SYNNR — Custom Operating Systems for Oilfield Service Companies";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(150deg, #1a1714 0%, #121110 55%, #0d0c0b 100%)",
          padding: "72px 80px",
          fontFamily: "sans-serif",
          color: "#ece5d7",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 46,
              height: 46,
              background: "#e7ddc7",
              transform: "rotate(45deg)",
              borderRadius: 10,
            }}
          />
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: 2 }}>SYNNR</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 30,
              color: "#a59d8c",
              textTransform: "uppercase",
              letterSpacing: 6,
            }}
          >
            AI automation &amp; ops agency
          </div>
          <div style={{ fontSize: 74, fontWeight: 700, lineHeight: 1.06, maxWidth: 1000 }}>
            Stop paying monthly for software that doesn&apos;t talk to each other.
          </div>
        </div>

        <div style={{ fontSize: 26, color: "#a59d8c", maxWidth: 920 }}>
          Custom operating systems for oilfield service companies — built on your
          cloud, owned by you. Build &amp; Transfer.
        </div>
      </div>
    ),
    { ...size }
  );
}
