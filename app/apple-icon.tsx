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
        <div
          style={{
            width: 64,
            height: 64,
            background: "#ff5a1f",
            borderRadius: 5,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
