import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#1a1614",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 120,
          fontFamily: "serif",
          fontWeight: 700,
          color: "#b08d57",
          letterSpacing: -4,
        }}
      >
        S
      </div>
    ),
    size,
  );
}
