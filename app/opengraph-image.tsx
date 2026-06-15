import { ImageResponse } from "next/og";

export const alt = "SYNNR — Purpose-built software for oilfield service companies";
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
            Software for oilfield service
          </div>
          <div style={{ fontSize: 74, fontWeight: 700, lineHeight: 1.06, maxWidth: 1000 }}>
            The boring operational stuff, finally done right.
          </div>
        </div>

        <div style={{ fontSize: 26, color: "#a59d8c", maxWidth: 920 }}>
          TallyShot — photograph a handwritten tally sheet, get clean Excel back,
          every shaky digit flagged for review.
        </div>
      </div>
    ),
    { ...size }
  );
}
