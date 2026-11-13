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

  it("node ids must be unique across roadmap files; quiz answers must be in range", () => {
    const dir = roadmapDir([node("shared")]);
    writeFileSync(join(dir, "y.json"), JSON.stringify({ id: "y", title: "Y", description: "d", nodes: [node("shared")] }));
    expect(() => loadRoadmaps(dir, exists)).toThrow(/unique across roadmaps/);
    const quiz = [0, 1, 2].map(() => ({ q: "q", options: ["a", "b"], answer: 0, why: "w" }));
    expect(() => loadRoadmaps(roadmapDir([{ ...node("a"), quiz: [...quiz, { q: "q", options: ["a", "b"], answer: 2, why: "w" }] }]), exists)).toThrow(/out of range/);
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

  it("admins, consultants and Admin-cert seekers get the Admin path", async () => {
    const { svc } = setup();
    expect((await svc.saveOnboarding("a", { role: "admin", level: "new", goal: "level-up", hours: "1-2" })).roadmapId).toBe("admin");
    expect((await svc.saveOnboarding("b", { role: "student", level: "new", goal: "admin-cert", hours: "1-2" })).roadmapId).toBe("admin");
    expect((await svc.saveOnboarding("c", { role: "developer", level: "new", goal: "pd1", hours: "1-2" })).roadmapId).toBe("developer");
  });

  it("quiz answers never reach the client; passing completes the step, failing doesn't", async () => {
    const { svc } = setup();
    await svc.saveOnboarding("u", { role: "admin", level: "new", goal: "admin-cert", hours: "3-5" });
    const v = await svc.view("admin", "u");
    const org = v.nodes.find((n) => n.id === "admin-org");
    expect(org?.quiz?.length).toBe(3);
    expect(JSON.stringify(v)).not.toMatch(/"answer"|"why"/);
    expect(org?.completeByQuiz).toBe(true);

    const maps = loadRoadmaps(ROADMAPS_DIR, exists);
    const key = maps.get("admin")?.nodes.find((n) => n.id === "admin-org")?.quiz?.map((q) => q.answer) ?? [];
    const wrong = key.map((a) => (a + 1) % 2);
    const failed = await svc.submitQuiz("u", "admin", "admin-org", [wrong[0] ?? 0, wrong[1] ?? 0, key[2] ?? 0]);
    expect(failed).toMatchObject({ passed: false, correct: 1 });
    expect(failed.roadmap.nodes.find((n) => n.id === "admin-org")?.state).not.toBe("done");

    const oneWrong = await svc.submitQuiz("u", "admin", "admin-org", [wrong[0] ?? 0, key[1] ?? 0, key[2] ?? 0]);
    expect(oneWrong).toMatchObject({ passed: true, correct: 2 });
    expect(oneWrong.results[0]).toMatchObject({ correct: false, answer: key[0] });
    expect(oneWrong.roadmap.nodes.find((n) => n.id === "admin-org")?.state).toBe("done");
  });

  it("quiz steps can't be ticked done without passing", async () => {
    const { svc } = setup();
    await svc.saveOnboarding("u", { role: "admin", level: "new", goal: "admin-cert", hours: "3-5" });
    await expect(svc.setRead("u", "admin", "admin-org", true)).rejects.toThrow(/quiz/);
    await expect(svc.submitQuiz("u", "admin", "admin-org", [0])).rejects.toThrow(/all 3/);
  });
});

import { mkdirSync } from "node:fs";
import request from "supertest";
import { buildApp } from "../src/app.ts";
import { DIAGRAM_DIR } from "../src/domain/roadmap.ts";

describe("roadmap diagrams, resources and optional steps", () => {
  const withDiagram = (nodes: unknown[]) => {
    const dir = roadmapDir(nodes);
    mkdirSync(join(dir, DIAGRAM_DIR));
    writeFileSync(join(dir, DIAGRAM_DIR, "flow.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
    return dir;
  };
  const quiz = [1, 2, 3].map((i) => ({ q: `q${i}`, options: ["a", "b"], answer: 0, why: "w" }));

  it("loads diagrams, picture questions and official links", () => {
    const ok = { ...node("a"), diagram: "flow", diagramCaption: "A flow diagram for testing.", resources: [{ title: "Docs page", url: "https://developer.salesforce.com/docs/x", kind: "docs" }], quiz: [{ ...quiz[0], image: "flow", imageAlt: "The flow diagram again." }, ...quiz.slice(1)] };
    expect(() => loadRoadmaps(withDiagram([ok]), exists)).not.toThrow();
  });

  it.each<[string, Record<string, unknown>, RegExp]>([
    ["a missing diagram", { diagram: "nope", diagramCaption: "A caption that is long enough." }, /existing diagram/],
    ["a diagram without a caption", { diagram: "flow" }, /diagramCaption/],
    ["a picture question without alt text", { quiz: [{ ...quiz[0], image: "flow" }, ...quiz.slice(1)] }, /imageAlt/],
    ["a link to an unofficial site", { resources: [{ title: "Some blog", url: "https://example.com/apex", kind: "guide" }] }, /not an official/],
    ["a plain-http link", { resources: [{ title: "Docs page", url: "http://developer.salesforce.com/x", kind: "docs" }] }, /./],
  ])("rejects %s", (_name, extra, error) => {
    expect(() => loadRoadmaps(withDiagram([{ ...node("a"), ...extra }]), exists)).toThrow(error);
  });

  it("the shipped picture questions keep their image but never their answer", async () => {
    const svc = new RoadmapService(loadRoadmaps(ROADMAPS_DIR, exists), catalog, new MemoryOnboarding(), new MemorySubmissionRepository(fixedClock()));
    const triggers = (await svc.view("developer", null)).nodes.find((n) => n.id === "triggers");
    const pictured = triggers?.quiz?.find((q) => q.image);
    expect(pictured).toMatchObject({ image: "order-of-execution" });
    expect(JSON.stringify(triggers?.quiz)).not.toMatch(/"answer"|"why"/);
  });

  it("optional steps are never 'next' and don't count toward progress", async () => {
    const dir = roadmapDir([node("a"), { ...node("extra"), optional: true }, node("b", ["a"])]);
    const ob = new MemoryOnboarding();
    const svc = new RoadmapService(loadRoadmaps(dir, exists), catalog, ob, new MemorySubmissionRepository(fixedClock()));
    await svc.saveOnboarding("u", { role: "developer", level: "new", goal: "pd1", hours: "3-5" });
    const v = await svc.view("x", "u");
    expect(v.total).toBe(2);
    expect(v.next).toBe("a");
    await svc.setRead("u", "x", "a", true);
    expect((await svc.view("x", "u")).next).toBe("b");
  });
});

describe("diagram route", () => {
  // The shipped roadmaps, so the shipped diagrams are what's served.
  const app = buildApp({ roadmaps: new RoadmapService(loadRoadmaps(ROADMAPS_DIR, exists), catalog, new MemoryOnboarding(), new MemorySubmissionRepository(fixedClock())) });

  it("serves a known diagram as a locked-down SVG", async () => {
    const res = await request(app).get("/api/v1/roadmaps/diagrams/order-of-execution.svg");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    expect(res.headers["content-security-policy"]).toContain("sandbox");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("404s unknown names and refuses anything that isn't a plain name", async () => {
    expect((await request(app).get("/api/v1/roadmaps/diagrams/nope.svg")).status).toBe(404);
    expect((await request(app).get("/api/v1/roadmaps/diagrams/..%2F..%2Fpackage.json")).status).toBe(400);
    expect((await request(app).get("/api/v1/roadmaps/diagrams/order-of-execution.txt")).status).toBe(400);
  });
});
