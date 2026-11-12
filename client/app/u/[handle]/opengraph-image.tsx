import { ImageResponse } from "next/og";

/** The preview card LinkedIn / X / Slack show when someone shares a profile link. */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "SFCode learner profile";

interface Card {
  displayName: string;
  handle: string;
  score: number;
  solved: number;
  rank: number | null;
  stats: { longestStreak: number };
  achievements: { earned: boolean }[];
  about: { certifications: string[] };
}

async function load(handle: string): Promise<Card | null> {
  const base = (process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:4100").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/api/v1/profile/${encodeURIComponent(handle)}`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return ((await res.json()) as { data: Card }).data;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const p = await load(handle);
  const stats = p
    ? [
        ["Points", String(p.score)],
        ["Solved", String(p.solved)],
        ["Rank", p.rank ? `#${p.rank}` : "-"],
        ["Best streak", `${p.stats.longestStreak}d`],
        ["Badges", String(p.achievements.filter((a) => a.earned).length)],
      ]
    : [];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 72, background: "linear-gradient(135deg, #0b1220 0%, #111a33 60%, #1e1b4b 100%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32, color: "#93c5fd" }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "linear-gradient(135deg,#38bdf8,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, color: "white" }}>{"</>"}</div>
          SFCode
        </div>
        <div style={{ marginTop: 56, fontSize: 76, fontWeight: 700, display: "flex" }}>{p?.displayName ?? `@${handle}`}</div>
        <div style={{ fontSize: 32, color: "#94a3b8", display: "flex" }}>{p ? `@${p.handle} · Salesforce practice` : "Salesforce practice, graded in a real org"}</div>
        <div style={{ marginTop: "auto", display: "flex", gap: 28 }}>
          {stats.map(([label, value]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", padding: "20px 28px", borderRadius: 18, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <div style={{ fontSize: 52, fontWeight: 700, display: "flex" }}>{value}</div>
              <div style={{ fontSize: 22, color: "#94a3b8", display: "flex" }}>{label}</div>
            </div>
          ))}
        </div>
        {p && p.about.certifications.length > 0 && <div style={{ marginTop: 24, fontSize: 24, color: "#7dd3fc", display: "flex" }}>{p.about.certifications.slice(0, 3).join(" · ")}</div>}
      </div>
    ),
    size,
  );
}
