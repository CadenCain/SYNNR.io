import { ImageResponse } from "next/og";

// iOS home-screen icon (PWA install). Mirrors app/icon.tsx, sized for Apple touch.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#08090a",
        }}
      >
        <svg width="104" height="104" viewBox="0 0 32 32">
          <path d="M10 3H30L28.2 9H12L25.4 18L22 29H2L3.8 23H20L6.6 14Z" fill="#ff5a1f" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
