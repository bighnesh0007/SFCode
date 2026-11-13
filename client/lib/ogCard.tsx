import { ImageResponse } from "next/og";

/** The 1200×630 share card used across the site: a kicker, a title and a footer line. */
export const OG_SIZE = { width: 1200, height: 630 };

export function ogCard({ kicker, title, footer }: { kicker: string; title: string; footer: string }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 72, background: "linear-gradient(135deg, #0b1220 0%, #111a33 60%, #1e1b4b 100%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32, color: "#93c5fd" }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "linear-gradient(135deg,#38bdf8,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, color: "white" }}>{"</>"}</div>
          SFCode
        </div>
        <div style={{ marginTop: 64, fontSize: 30, color: "#7dd3fc", display: "flex", textTransform: "uppercase", letterSpacing: 2 }}>{kicker}</div>
        <div style={{ marginTop: 12, fontSize: title.length > 40 ? 64 : 80, fontWeight: 700, lineHeight: 1.1, display: "flex" }}>{title}</div>
        <div style={{ marginTop: "auto", fontSize: 30, color: "#94a3b8", display: "flex" }}>{footer}</div>
      </div>
    ),
    OG_SIZE,
  );
}
