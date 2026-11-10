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
          <path d="M2 2H30V8H13L9 13H30V30H2V24H19L23 19H2Z" fill="#ff5a1f" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
