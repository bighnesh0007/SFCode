import { describe, expect, it } from "vitest";
import { isAutoSlug, pickProblems, upcoming } from "../src/domain/autoContest.ts";

const DAY = 24 * 3600_000;
const at = (iso: string) => Date.parse(iso);

describe("auto contest calendar", () => {
  it("weekly on Sundays and biweekly on alternate Saturdays, both 8 PM IST for 90 minutes", () => {
    const list = upcoming(at("2026-11-17T00:00:00Z"), 7 * DAY);
    expect(list.map((o) => [o.slug, o.startsAt.toISOString(), o.endsAt.toISOString()])).toEqual([
      ["biweekly-contest-1", "2026-11-21T14:30:00.000Z", "2026-11-21T16:00:00.000Z"],
      ["weekly-contest-1", "2026-11-22T14:30:00.000Z", "2026-11-22T16:00:00.000Z"],
    ]);
    // 14:30 UTC is 20:00 in India (UTC+5:30), on a Saturday and a Sunday.
    expect(list.map((o) => new Date(o.startsAt.getTime() + 5.5 * 3600_000).getUTCDay())).toEqual([6, 0]);
    expect(new Date(list[0]!.startsAt.getTime() + 5.5 * 3600_000).getUTCHours()).toBe(20);
  });

  it("numbers advance with the calendar and skip a contest that has started", () => {
    const list = upcoming(at("2026-11-22T15:00:00Z"), 14 * DAY);
    expect(list.map((o) => o.slug)).toEqual(["weekly-contest-2", "biweekly-contest-2", "weekly-contest-3"]);
    expect(list[0]?.title).toBe("Weekly Contest 2");
    expect(list[1]?.startsAt.toISOString()).toBe("2026-12-05T14:30:00.000Z");
  });

  it("only its own slugs count as automatic", () => {
    expect(isAutoSlug("weekly-contest-12")).toBe(true);
    expect(isAutoSlug("biweekly-contest-3")).toBe(true);
    expect(isAutoSlug("spring-cup")).toBe(false);
  });
});

describe("contest problem picks", () => {
  const pool = [
    ...["a", "b", "c"].map((t, i) => ({ slug: `easy-${i}`, track: ["apex", "soql", "lwc"][i] ?? t, difficulty: "Easy" })),
    ...[0, 1, 2, 3, 4].map((i) => ({ slug: `med-${i}`, track: ["apex", "apex", "soql", "debug", "lwc"][i] ?? "apex", difficulty: "Medium" })),
    ...[0, 1].map((i) => ({ slug: `hard-${i}`, track: ["apex", "lwc"][i] ?? "apex", difficulty: "Hard" })),
  ];
  const diff = (slug: string) => pool.find((p) => p.slug === slug)?.difficulty;

  it("Easy, Medium, Medium, Hard at 10/20/20/40 points, all different", () => {
    const picks = pickProblems("weekly-contest-1", pool, new Set());
    expect(picks.map((p) => diff(p.slug))).toEqual(["Easy", "Medium", "Medium", "Hard"]);
    expect(picks.map((p) => p.points)).toEqual([10, 20, 20, 40]);
    expect(new Set(picks.map((p) => p.slug)).size).toBe(4);
  });

  it("is the same set for the same contest, and differs between contests", () => {
    expect(pickProblems("weekly-contest-1", pool, new Set())).toEqual(pickProblems("weekly-contest-1", pool, new Set()));
    const many = new Set(Array.from({ length: 10 }, (_, i) => JSON.stringify(pickProblems(`weekly-contest-${i}`, pool, new Set()))));
    expect(many.size).toBeGreaterThan(1);
  });

  it("avoids recently used problems when it can, and falls back when it can't", () => {
    const used = new Set(["easy-0", "easy-1", "hard-0"]);
    const picks = pickProblems("weekly-contest-9", pool, used);
    expect(picks[0]?.slug).toBe("easy-2");
    expect(picks[3]?.slug).toBe("hard-1");
    const allUsed = new Set(pool.map((p) => p.slug));
    expect(pickProblems("weekly-contest-9", pool, allUsed)).toHaveLength(4);
  });

  it("spreads tracks: the first three picks never share a track when they don't have to", () => {
    for (let i = 0; i < 20; i++) {
      const picks = pickProblems(`biweekly-contest-${i}`, pool, new Set());
      const tracks = picks.slice(0, 3).map((p) => pool.find((x) => x.slug === p.slug)?.track);
      expect(new Set(tracks).size).toBe(3);
    }
  });
});
