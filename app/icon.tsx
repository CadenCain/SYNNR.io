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
          background: "#121110",
          borderRadius: 14,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            background: "#e7ddc7",
            transform: "rotate(45deg)",
            borderRadius: 7,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
