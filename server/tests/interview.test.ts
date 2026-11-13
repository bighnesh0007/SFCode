import { describe, expect, it } from "vitest";
import { PROBLEMS_DIR } from "../src/container.ts";
import { interviewVerdict, outcomeFor } from "../src/domain/interview.ts";
import type { ChallengeSubmissionRepository, SubmissionRecord } from "../src/repositories/challengeSubmission.repository.ts";
import { ChallengeCatalog } from "../src/services/challenges/catalog.ts";
import { InterviewService } from "../src/services/interview/interview.service.ts";
import { PointsService } from "../src/services/points/points.service.ts";

const T0 = new Date("2026-11-13T10:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const sub = (status: string, min: number) => ({ status, createdAt: at(min) });

describe("interview scoring", () => {
  const end = at(60);
  it("counts the first accept in the window and wrong attempts before it", () => {
    expect(outcomeFor([sub("wrong_answer", 5), sub("compile_error", 9), sub("accepted", 21), sub("wrong_answer", 30)], T0, end)).toEqual({ solved: true, solvedAfterMinutes: 21, wrongAttempts: 2 });
  });
  it("ignores submissions outside the window, running ones, and infrastructure errors", () => {
    expect(outcomeFor([sub("accepted", -10), sub("error", 3), sub("running", 4), sub("wrong_answer", 70), sub("accepted", 61)], T0, end)).toEqual({ solved: false, solvedAfterMinutes: null, wrongAttempts: 0 });
  });
  it("unsolved: every graded miss counts", () => {
    expect(outcomeFor([sub("wrong_answer", 1), sub("coverage", 2)], T0, end)).toMatchObject({ solved: false, wrongAttempts: 2 });
  });
  it("verdicts", () => {
    expect([interviewVerdict(3, 3), interviewVerdict(2, 3), interviewVerdict(1, 3), interviewVerdict(0, 3)]).toEqual(["Strong hire", "Lean hire", "Lean no hire", "No hire, this time"]);
  });
});

describe("InterviewService", () => {
  const catalog = ChallengeCatalog.load(PROBLEMS_DIR);
  const solvedSet = new Set(catalog.all().filter((c) => c.track === "apex").slice(0, 3).map((c) => c.slug));
  const subs = {
    progress: () => Promise.resolve(new Map([...solvedSet].map((s) => [s, "solved" as const]))),
    listForProblem: (_u: string, slug: string) =>
      Promise.resolve(slug === "text-utils" ? ([{ status: "wrong_answer", createdAt: at(2) }, { status: "accepted", createdAt: at(12) }] as SubmissionRecord[]) : []),
  } as unknown as ChallengeSubmissionRepository;
  let seed = 0.37;
  const svc = new InterviewService(catalog, subs, new PointsService(undefined, undefined), () => (seed = (seed * 9301 + 0.49297) % 1));

  it("picks distinct problems from the chosen tracks, unsolved first, at most one Hard, easiest first", async () => {
    for (let i = 0; i < 20; i++) {
      const set = await svc.start("u", 4, ["apex", "soql"]);
      expect(new Set(set.map((p) => p.slug)).size).toBe(4);
      expect(set.every((p) => p.track === "apex" || p.track === "soql")).toBe(true);
      expect(set.filter((p) => p.difficulty === "Hard").length).toBeLessThanOrEqual(1);
      expect(set.some((p) => solvedSet.has(p.slug))).toBe(false); // plenty of unsolved ones exist
      const rank = { Easy: 0, Medium: 1, Hard: 2 } as Record<string, number>;
      expect(set.map((p) => rank[p.difficulty])).toEqual([...set.map((p) => rank[p.difficulty])].sort());
    }
  });

  it("never more than one Hard when easier problems exist", async () => {
    const mk = (slug: string, difficulty: string) => ({ slug, title: slug, track: "apex", difficulty });
    const small = { all: () => [mk("h1", "Hard"), mk("h2", "Hard"), mk("h3", "Hard"), mk("e1", "Easy"), mk("e2", "Easy")] } as unknown as ChallengeCatalog;
    const none = { progress: () => Promise.resolve(new Map()) } as unknown as ChallengeSubmissionRepository;
    const s = new InterviewService(small, none, new PointsService(undefined, undefined), () => 0);
    const set = await s.start("u", 3, ["apex"]);
    expect(set.map((p) => p.difficulty)).toEqual(["Easy", "Easy", "Hard"]);
    // Only Hards left to fill with: the limit gives way rather than returning too few.
    expect((await s.start("u", 4, ["apex"])).filter((p) => p.difficulty === "Hard")).toHaveLength(2);
  });

  it("refuses flow-only or empty choices and too many problems", async () => {
    await expect(svc.start("u", 3, [])).rejects.toThrow(/at least one track/);
    await expect(svc.start("u", 3, ["flow"])).rejects.toThrow(/at least one track/);
    await expect(svc.start("u", 50, ["lwc"])).rejects.toThrow(/only/);
  });

  it("scores from real submissions in the window", async () => {
    const card = await svc.score("u", ["text-utils", "soql-hot-tech-accounts"], T0, at(45));
    expect(card).toMatchObject({ solved: 1, total: 2, wrongAttempts: 1, verdict: "Lean hire" });
    expect(card.problems[0]).toMatchObject({ slug: "text-utils", solved: true, solvedAfterMinutes: 12 });
    expect(card.score).toBe(card.problems[0]?.points);
    await expect(svc.score("u", ["nope"], T0, at(45))).rejects.toThrow(/Unknown/);
    await expect(svc.score("u", ["text-utils"], at(45), T0)).rejects.toThrow(/end after/);
  });
});
