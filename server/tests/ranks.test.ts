import { describe, expect, it } from "vitest";
import { RANKS, rankFor } from "../src/domain/ranks.ts";

describe("ranks", () => {
  it("boundaries: the minimum reaches the rank, one below doesn't", () => {
    for (const [i, r] of RANKS.entries()) {
      expect(rankFor(r.min)).toMatchObject({ id: r.id, level: i });
      if (r.min > 0) expect(rankFor(r.min - 1).level).toBe(i - 1);
    }
  });

  it("progress towards the next rank, capped at Legend", () => {
    expect(rankFor(0)).toMatchObject({ id: "novice", progress: 0, next: { title: "Trailblazer", min: 10 } });
    expect(rankFor(20)).toMatchObject({ id: "trailblazer", progress: 50 });
    expect(rankFor(500)).toMatchObject({ id: "legend", progress: 100, next: null });
  });
});
