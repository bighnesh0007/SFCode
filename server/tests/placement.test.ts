import { describe, expect, it } from "vitest";
import { PLACEMENT, placementLevel, placementQuestions } from "../src/domain/placement.ts";

const right = (track: "developer" | "admin", tiers: number[]) => Object.fromEntries(PLACEMENT[track].filter((q) => tiers.includes(q.tier)).map((q) => [q.id, q.answer]));

describe("placement check", () => {
  it("each track has 3 + 3 + 2 questions with valid answers", () => {
    for (const track of ["developer", "admin"] as const) {
      expect(PLACEMENT[track].map((q) => q.tier)).toEqual([1, 1, 1, 2, 2, 2, 3, 3]);
      for (const q of PLACEMENT[track]) expect(q.answer).toBeLessThan(q.options.length);
    }
  });

  it("suggests the highest tier passed, only counting tiers whose lower tiers passed", () => {
    expect(placementLevel("developer", {}).level).toBe("new");
    expect(placementLevel("developer", right("developer", [1])).level).toBe("basics");
    expect(placementLevel("developer", right("developer", [1, 2])).level).toBe("production");
    expect(placementLevel("developer", right("developer", [1, 2, 3]))).toMatchObject({ level: "lead", correct: 8, total: 8 });
    // Advanced answers without the basics don't place you high.
    expect(placementLevel("admin", right("admin", [2, 3])).level).toBe("new");
  });

  it("two of three in a tier is a pass; one is not", () => {
    const answers = right("developer", [1]);
    delete answers.d1;
    expect(placementLevel("developer", answers).level).toBe("basics");
    delete answers.d2;
    expect(placementLevel("developer", answers).level).toBe("new");
  });

  it("never sends answers to the browser", () => {
    expect(JSON.stringify(placementQuestions("admin"))).not.toMatch(/answer|tier/);
  });
});

import request from "supertest";
import { buildApp } from "../src/app.ts";

describe("placement routes", () => {
  const app = buildApp({});
  it("serves questions without answers and grades a submission", async () => {
    const qs = await request(app).get("/api/v1/placement/developer");
    expect(qs.status).toBe(200);
    expect(qs.body.data).toHaveLength(8);
    expect(JSON.stringify(qs.body)).not.toContain("answer");
    const graded = await request(app).post("/api/v1/placement/developer").send({ answers: { d1: 0, d2: 1, d3: 1 } });
    expect(graded.body.data).toMatchObject({ level: "basics", correct: 3, total: 8 });
  });
  it("validates", async () => {
    expect((await request(app).get("/api/v1/placement/architect")).status).toBe(400);
    expect((await request(app).post("/api/v1/placement/admin").send({ answers: { a1: "x" } })).status).toBe(400);
  });
});
