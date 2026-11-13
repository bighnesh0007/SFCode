/**
 * Ranks from total points (the admin-editable points table). With the
 * built-in problems worth ~100 points, Legend means solving nearly all of
 * them; community problems keep it reachable as the catalog grows.
 */
export const RANKS = [
  { id: "novice", title: "Novice", min: 0 },
  { id: "trailblazer", title: "Trailblazer", min: 10 },
  { id: "ranger", title: "Ranger", min: 30 },
  { id: "expert", title: "Expert", min: 60 },
  { id: "legend", title: "Legend", min: 100 },
] as const;

export type RankId = (typeof RANKS)[number]["id"];

export interface RankView {
  id: RankId;
  title: string;
  /** 0-based position, so clients can compare ranks. */
  level: number;
  points: number;
  next: { title: string; min: number } | null;
  /** 0–100 towards the next rank (100 at Legend). */
  progress: number;
}

export function rankFor(points: number): RankView {
  let level = 0;
  RANKS.forEach((r, i) => {
    if (points >= r.min) level = i;
  });
  const cur = RANKS[level] ?? RANKS[0];
  const next = RANKS[level + 1];
  const progress = next ? Math.max(0, Math.min(100, Math.floor((100 * (points - cur.min)) / (next.min - cur.min)))) : 100;
  return { id: cur.id, title: cur.title, level, points, next: next ? { title: next.title, min: next.min } : null, progress };
}
