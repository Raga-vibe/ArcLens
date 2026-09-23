import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#08090b" }}>
        <svg width="120" height="120" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="12.5" fill="none" stroke="#f4f4f0" strokeWidth="2.2" />
          <path d="M5.5 21.5C9 13 23 13 26.5 21.5" fill="none" stroke="#a9c4f0" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="16" cy="15" r="3" fill="#a9c4f0" />
        </svg>
      </div>
    ),
    size,
  );
}
