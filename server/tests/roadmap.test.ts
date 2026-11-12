import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROBLEMS_DIR, ROADMAPS_DIR } from "../src/container.ts";
import { loadRoadmaps } from "../src/domain/roadmap.ts";
import type { OnboardingRecord, OnboardingRepository } from "../src/repositories/onboarding.repository.ts";
import { ChallengeCatalog } from "../src/services/challenges/catalog.ts";
import { RoadmapService } from "../src/services/roadmap/roadmap.service.ts";
import { MemorySubmissionRepository, fixedClock } from "./fakes.ts";

const catalog = ChallengeCatalog.load(PROBLEMS_DIR);
const exists = (slug: string) => catalog.get(slug) !== undefined;

class MemoryOnboarding implements OnboardingRepository {
  rows = new Map<string, OnboardingRecord>();
  get(userId: string) {
    return Promise.resolve(this.rows.get(userId) ?? null);
  }
  save(rec: Omit<OnboardingRecord, "readNodes">) {
    const row = { ...rec, readNodes: this.rows.get(rec.userId)?.readNodes ?? [] };
    this.rows.set(rec.userId, row);
    return Promise.resolve(row);
  }
  setRead(userId: string, nodeId: string, read: boolean) {
    const row = this.rows.get(userId);
    if (!row) return Promise.resolve(null);
    row.readNodes = read ? [...new Set([...row.readNodes, nodeId])] : row.readNodes.filter((n) => n !== nodeId);
    return Promise.resolve(row.readNodes);
  }
}

function roadmapDir(nodes: unknown[]): string {
  const dir = mkdtempSync(join(tmpdir(), "rm-"));
  writeFileSync(join(dir, "x.json"), JSON.stringify({ id: "x", title: "X", description: "d", nodes }));
  return dir;
}
const node = (id: string, requires: string[] = [], problems: string[] = []) => ({ id, title: id, summary: "s", level: 1, col: 0, requires, problems, lesson: "l" });

describe("roadmap content", () => {
  it("the shipped roadmaps load and link only real problems", () => {
    const maps = loadRoadmaps(ROADMAPS_DIR, exists);
    expect(maps.get("developer")?.nodes.length).toBeGreaterThan(5);
  });

  it("rejects unknown problems, unknown prerequisites and cycles", () => {
    expect(() => loadRoadmaps(roadmapDir([node("a", [], ["no-such-problem"])]), exists)).toThrow(/unknown problem/);
    expect(() => loadRoadmaps(roadmapDir([node("a", ["ghost"])]), exists)).toThrow(/unknown node/);
    expect(() => loadRoadmaps(roadmapDir([node("a", ["b"]), node("b", ["a"])]), exists)).toThrow(/cycle/);
  });
});

describe("RoadmapService", () => {
  function setup() {
    const subs = new MemorySubmissionRepository(fixedClock());
    const ob = new MemoryOnboarding();
    const svc = new RoadmapService(loadRoadmaps(ROADMAPS_DIR, exists), catalog, ob, subs);
    const solve = async (userId: string, slug: string, status: "accepted" | "wrong_answer" = "accepted") => {
      const s = await subs.createRunning({ userId, problemSlug: slug, orgId: "o", files: {} });
      if (!s) throw new Error("not created");
      await subs.complete(s.id, status, { verdict: status } as never, new Date());
    };
    return { svc, solve };
  }

  it("a new learner starts at the root; everything downstream is locked", async () => {
    const { svc } = setup();
    await svc.saveOnboarding("u", { role: "developer", level: "new", goal: "pd1", hours: "3-5" });
    const v = await svc.view("developer", "u");
    expect(v.next).toBe("data-model");
    expect(v.nodes.find((n) => n.id === "soql-basics")?.state).toBe("locked");
    expect(v.nodes.find((n) => n.id === "triggers")?.state).toBe("locked");
  });

  it("solves complete nodes; failures flag struggling; reading completes lessons", async () => {
    const { svc, solve } = setup();
    await svc.saveOnboarding("u", { role: "developer", level: "new", goal: "pd1", hours: "3-5" });
    await svc.setRead("u", "developer", "data-model", true);
    await solve("u", "soql-hot-tech-accounts");
    let v = await svc.view("developer", "u");
    expect(v.nodes.find((n) => n.id === "data-model")?.state).toBe("done");
    expect(v.nodes.find((n) => n.id === "soql-basics")?.state).toBe("in_progress");
    expect(v.next).toBe("soql-basics");

    await solve("u", "soql-contacts-in-city", "wrong_answer");
    v = await svc.view("developer", "u");
    expect(v.nodes.find((n) => n.id === "soql-basics")?.struggling).toBe(true);

    await solve("u", "soql-contacts-in-city");
    v = await svc.view("developer", "u");
    expect(v.nodes.find((n) => n.id === "soql-basics")?.state).toBe("done");
    expect(v.nodes.find((n) => n.id === "apex-basics")?.state).toBe("available");
  });

  it("a production developer skips the basics: assumed, and they unlock what follows", async () => {
    const { svc } = setup();
    await svc.saveOnboarding("u", { role: "developer", level: "production", goal: "level-up", hours: "1-2" });
    const v = await svc.view("developer", "u");
    expect(v.nodes.find((n) => n.id === "apex-basics")?.state).toBe("assumed");
    expect(v.nodes.find((n) => n.id === "triggers")?.state).toBe("available");
    expect(v.nodes.find((n) => n.id === "governor-limits")?.state).toBe("locked");
    expect(v.total).toBeLessThan(v.nodes.length);
  });

  it("anonymous viewers see the map without progress", async () => {
    const { svc } = setup();
    const v = await svc.view("developer", null);
    expect(v.personalised).toBe(false);
    expect(v.done).toBe(0);
  });

  it("marking read needs the quiz and a real node", async () => {
    const { svc } = setup();
    await expect(svc.setRead("nobody", "developer", "data-model", true)).rejects.toThrow(/welcome quiz/);
    await svc.saveOnboarding("u", { role: "developer", level: "new", goal: "pd1", hours: "3-5" });
    await expect(svc.setRead("u", "developer", "nope", true)).rejects.toMatchObject({ status: 404 });
  });
});
