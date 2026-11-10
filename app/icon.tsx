import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 14,
        }}
      >
        <svg width="40" height="40" viewBox="0 0 32 32">
          <path d="M10 3H30L28.2 9H12L25.4 18L22 29H2L3.8 23H20L6.6 14Z" fill="#ff5a1f" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
