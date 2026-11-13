import { describe, expect, it } from "vitest";
import { INITIAL_RATING, replayRatings, type ContestPlacing } from "../src/domain/rating.ts";

const contest = (slug: string, endsAt: string, ranks: [string, number][]): ContestPlacing => ({ contestSlug: slug, title: slug, endsAt, ranks: new Map(ranks) });

describe("contest rating", () => {
  it("winner gains, loser loses, equal ratings move symmetrically by K/2 in a 2-player contest", () => {
    const h = replayRatings([contest("c1", "2026-01-01", [["a", 1], ["b", 2]])]);
    expect(h.get("a")?.[0]).toMatchObject({ rating: INITIAL_RATING + 20, delta: 20, rank: 1, entrants: 2 });
    expect(h.get("b")?.[0]).toMatchObject({ rating: INITIAL_RATING - 20, delta: -20 });
  });

  it("ties are half a win; nothing changes for equal players who tie", () => {
    const h = replayRatings([contest("c1", "2026-01-01", [["a", 1], ["b", 1]])]);
    expect(h.get("a")?.[0]?.delta).toBe(0);
  });

  it("an upset moves more than an expected result; contests replay in date order", () => {
    // a beats b first (a ahead), then b beats a: b's upset gain exceeds a's earlier gain.
    const h = replayRatings([contest("late", "2026-02-01", [["b", 1], ["a", 2]]), contest("early", "2026-01-01", [["a", 1], ["b", 2]])]);
    const b = h.get("b") ?? [];
    expect(b.map((p) => p.contestSlug)).toEqual(["early", "late"]);
    expect(b[1]?.delta).toBeGreaterThan(20);
  });

  it("solo contests don't rate; one contest moves at most ±40", () => {
    expect(replayRatings([contest("solo", "2026-01-01", [["a", 1]])]).size).toBe(0);
    const big = replayRatings([contest("c", "2026-01-01", Array.from({ length: 10 }, (_, i): [string, number] => [`p${i}`, i + 1]))]);
    for (const [, pts] of big) expect(Math.abs(pts[0]?.delta ?? 0)).toBeLessThanOrEqual(40);
    expect(big.get("p0")?.[0]?.delta).toBe(20); // beats 9 equals: 40 × (9 − 4.5) / 9
  });
});
