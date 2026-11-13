import { describe, expect, it } from "vitest";
import { achievements, streaks } from "../src/domain/achievements.ts";
import { aboutBody } from "../src/validation/community.schema.ts";

describe("streaks", () => {
  it("counts the current run through today or yesterday, and the longest run", () => {
    const days = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-10", "2026-01-11"];
    expect(streaks(days, "2026-01-11")).toMatchObject({ current: 2, longest: 3 });
    expect(streaks(days, "2026-01-12")).toMatchObject({ current: 2, longest: 3 }); // yesterday still counts
    expect(streaks(days, "2026-01-13")).toMatchObject({ current: 0, longest: 3 }); // broken
    expect(streaks([], "2026-01-13")).toMatchObject({ current: 0, longest: 0 });
  });

  it("a freeze bridges one missed day; two gaps need two freezes; unused freezes aren't spent", () => {
    // Active 1st–3rd, missed 4th, active 5th–6th; today is the 6th.
    const days = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-05", "2026-01-06"];
    expect(streaks(days, "2026-01-06")).toMatchObject({ current: 2, freezesUsed: 0 });
    expect(streaks(days, "2026-01-06", 1)).toMatchObject({ current: 5, freezesUsed: 1 });
    expect(streaks(days, "2026-01-06", 2)).toMatchObject({ current: 5, freezesUsed: 1 }); // nothing more to bridge
    // A two-day gap can't be bridged by one freeze.
    expect(streaks(["2026-01-01", "2026-01-04"], "2026-01-04", 1)).toMatchObject({ current: 1, freezesUsed: 0 });
    // Missed yesterday and today so far: a freeze keeps the streak alive.
    expect(streaks(["2026-01-01", "2026-01-02"], "2026-01-04")).toMatchObject({ current: 0 });
    expect(streaks(["2026-01-01", "2026-01-02"], "2026-01-04", 1)).toMatchObject({ current: 2, freezesUsed: 1 });
  });

  it("handles month and year boundaries", () => {
    expect(streaks(["2025-12-31", "2026-01-01"], "2026-01-01").current).toBe(2);
    expect(streaks(["2026-02-28", "2026-03-01"], "2026-03-01").current).toBe(2);
  });
});

describe("achievements", () => {
  const base = { solved: [], score: 0, longestStreak: 0, contestsEntered: 0, bestPlacement: null, roadmapPct: null };
  const get = (list: ReturnType<typeof achievements>, id: string) => list.find((a) => a.id === id);

  it("nothing earned for a new learner, with progress from zero", () => {
    const list = achievements(base);
    expect(list.every((a) => !a.earned)).toBe(true);
    expect(get(list, "century")?.progress).toEqual({ current: 0, target: 100 });
  });

  it("earns on thresholds and caps progress at the target", () => {
    const soql = (n: number) => ({ slug: `s${n}`, track: "soql", difficulty: "Hard", category: "Filtering" });
    const list = achievements({ ...base, solved: [soql(1), soql(2), soql(3), soql(4)], score: 160, longestStreak: 8, contestsEntered: 1, bestPlacement: 2, roadmapPct: 40 });
    expect(get(list, "query-whisperer")).toMatchObject({ earned: true, progress: { current: 3, target: 3 } });
    expect(get(list, "hard-mode")?.earned).toBe(true);
    expect(get(list, "century")?.earned).toBe(true);
    expect(get(list, "streak-7")?.earned).toBe(true);
    expect(get(list, "streak-30")?.earned).toBe(false);
    expect(get(list, "podium")?.earned).toBe(true);
    expect(get(list, "pathfinder")).toMatchObject({ earned: false, progress: { current: 40, target: 50 } });
    expect(get(list, "trigger-tamer")?.earned).toBe(false);
  });

  it("4th place is not a podium", () => {
    expect(get(achievements({ ...base, contestsEntered: 1, bestPlacement: 4 }), "podium")?.earned).toBe(false);
  });
});

describe("about section validation", () => {
  const ok = { bio: "", company: "", location: "", trailheadUrl: "", linkedinUrl: "", githubUrl: "", certifications: [], openToWork: false };
  it("accepts empty and real profile links", () => {
    expect(aboutBody.safeParse(ok).success).toBe(true);
    expect(aboutBody.safeParse({ ...ok, linkedinUrl: "https://www.linkedin.com/in/ada", githubUrl: "https://github.com/ada", trailheadUrl: "https://www.salesforce.com/trailblazer/ada", certifications: ["Platform Developer I"] }).success).toBe(true);
  });
  it("rejects other hosts, look-alike hosts, http, javascript: and unknown certifications", () => {
    for (const bad of [
      { linkedinUrl: "https://evil.com/in/ada" },
      { linkedinUrl: "https://linkedin.com.evil.com/in/ada" },
      { githubUrl: "http://github.com/ada" },
      { githubUrl: "javascript:alert(1)" },
      { certifications: ["Wizard"] },
      { bio: "x".repeat(281) },
    ]) expect(aboutBody.safeParse({ ...ok, ...bad }).success, JSON.stringify(bad)).toBe(false);
  });
});
