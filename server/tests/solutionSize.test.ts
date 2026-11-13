import { describe, expect, it } from "vitest";
import { SolutionSizeService } from "../src/services/size/solutionSize.service.ts";
import { fixedClock, MemorySubmissionRepository } from "./fakes.ts";

const result = { tests: [] } as never;

async function submit(repo: MemorySubmissionRepository, userId: string, src: string, status: "accepted" | "wrong_answer", slug = "p") {
  const s = await repo.createRunning({ userId, problemSlug: slug, orgId: "o", files: src ? { "A.cls": src } : {} });
  if (!s) throw new Error("already running");
  await repo.complete(s.id, status, result, new Date());
}

describe("SolutionSizeService", () => {
  it("uses each solver's smallest accepted solution and ignores the rest", async () => {
    const repo = new MemorySubmissionRepository(fixedClock());
    await submit(repo, "me", "x".repeat(50), "accepted");
    await submit(repo, "me", "x".repeat(30), "accepted");
    await submit(repo, "you", "x".repeat(10), "wrong_answer"); // rejected attempts don't count
    await submit(repo, "you", "x".repeat(40), "accepted");
    await submit(repo, "them", "x".repeat(5), "accepted", "other"); // a different problem
    await submit(repo, "flow", "", "accepted"); // nothing submitted
    const svc = new SolutionSizeService(repo, () => true);
    expect(await svc.stats("me", "p")).toEqual({ mine: 30, median: 35, smallest: 30, solvers: 2, smallerThan: 100 });
    expect(await svc.stats("flow", "p")).toBeNull();
    expect(await svc.stats("stranger", "p")).toBeNull();
  });

  it("404s an unknown problem", async () => {
    await expect(new SolutionSizeService(new MemorySubmissionRepository(fixedClock()), () => false).stats("me", "nope")).rejects.toThrow("Problem not found");
  });
});
