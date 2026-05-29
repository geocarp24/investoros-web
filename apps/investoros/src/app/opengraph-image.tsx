import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "InvestorOS — 27 AI Agents for Home Service Businesses";

/**
 * Homepage OG image. Per-slug OG images for /es/[slug] live in
 * src/app/es/[slug]/opengraph-image.tsx and are category-aware.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090f",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-200px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "900px",
            height: "600px",
            background:
              "radial-gradient(ellipse at center, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0) 70%)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 12,
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
              color: "white",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            IO
          </div>
          <div style={{ fontSize: 56, fontWeight: 800, color: "#f8f8ff" }}>InvestorOS</div>
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "#f8f8ff",
            textAlign: "center",
            maxWidth: 980,
            lineHeight: 1.1,
            letterSpacing: "-1.5px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          27 AI Agents for Home Service Businesses
        </div>
        <div style={{ fontSize: 26, color: "#a5b4fc", marginTop: 32, display: "flex" }}>
          investoros.tech
        </div>
      </div>
    ),
    { ...size }
  );
}
