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
          <path d="M2 2H30V8H13L9 13H30V30H2V24H19L23 19H2Z" fill="#ff5a1f" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
