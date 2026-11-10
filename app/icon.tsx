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
        <div
          style={{
            width: 24,
            height: 24,
            background: "#ff5a1f",
            borderRadius: 2,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
