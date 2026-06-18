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
          background: "#121110",
        }}
      >
        <div
          style={{
            width: 86,
            height: 86,
            background: "#e7ddc7",
            transform: "rotate(45deg)",
            borderRadius: 20,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
