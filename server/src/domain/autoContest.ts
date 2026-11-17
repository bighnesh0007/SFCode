/**
 * The automatic contest calendar. Pure functions so the schedule and the
 * problem picks can be tested without a clock or a database.
 *
 *   Weekly Contest:   every Sunday, 14:30 UTC (8:00 PM IST), 90 minutes.
 *   Biweekly Contest: every other Saturday, 14:30 UTC (8:00 PM IST), 90 minutes.
 *
 * Numbers count from the first occurrence, so "Weekly Contest 3" always means
 * the same date, and the slug doubles as the "already created" check.
 */
import { createHash } from "node:crypto";

const WEEK_MS = 7 * 24 * 3600_000;
export const CONTEST_MINUTES = 90;

export const SERIES = [
  { id: "weekly", title: "Weekly Contest", first: Date.UTC(2026, 10, 22, 14, 30), everyMs: WEEK_MS },
  { id: "biweekly", title: "Biweekly Contest", first: Date.UTC(2026, 10, 21, 14, 30), everyMs: 2 * WEEK_MS },
] as const;

export interface Occurrence {
  slug: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
}

/** Contests starting after `now` and within `horizonMs`, in start order. */
export function upcoming(now: number, horizonMs: number): Occurrence[] {
  const out: Occurrence[] = [];
  for (const s of SERIES) {
    // The first occurrence strictly after now (number 1 is the first date).
    let n = Math.max(1, Math.floor((now - s.first) / s.everyMs) + 1);
    if (s.first + (n - 1) * s.everyMs <= now) n++;
    for (;; n++) {
      const start = s.first + (n - 1) * s.everyMs;
      if (start > now + horizonMs) break;
      out.push({ slug: `${s.id}-contest-${n}`, title: `${s.title} ${n}`, startsAt: new Date(start), endsAt: new Date(start + CONTEST_MINUTES * 60_000) });
    }
  }
  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Slugs the scheduler owns, so a deleted one can be remembered and not recreated. */
export const isAutoSlug = (slug: string) => /^(weekly|biweekly)-contest-\d+$/.test(slug);

export interface Candidate {
  slug: string;
  track: string;
  difficulty: string;
}

/** Easy, Medium, Medium, Hard: points follow the site's 10/20/40 scale. */
export const PLAN = [
  { difficulty: "Easy", points: 10 },
  { difficulty: "Medium", points: 20 },
  { difficulty: "Medium", points: 20 },
  { difficulty: "Hard", points: 40 },
] as const;

/**
 * Picks the problems for one contest: deterministic for a slug (a restart picks
 * the same set), avoids problems used recently when it can, and spreads tracks
 * so one contest isn't four SOQL problems.
 */
export function pickProblems(slug: string, candidates: Candidate[], recentlyUsed: Set<string>): { slug: string; points: number }[] {
  const rank = (s: string) => createHash("sha256").update(`${slug}:${s}`).digest("hex");
  const picked: Candidate[] = [];
  for (const step of PLAN) {
    const open = candidates.filter((c) => c.difficulty === step.difficulty && !picked.some((p) => p.slug === c.slug));
    const fresh = open.filter((c) => !recentlyUsed.has(c.slug));
    const pool = (fresh.length ? fresh : open).sort((a, b) => rank(a.slug).localeCompare(rank(b.slug)));
    const usedTracks = new Set(picked.map((p) => p.track));
    const choice = pool.find((c) => !usedTracks.has(c.track)) ?? pool[0];
    if (choice) picked.push(choice);
  }
  return picked.map((c, i) => ({ slug: c.slug, points: PLAN[i]?.points ?? 10 }));
}
