import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.ts";

// An empty container is what an unconfigured server builds.
const app = buildApp({});

describe("routes without configuration", () => {
  it("serves /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: "ok" } });
  });

  it("answers Salesforce routes with 503 NOT_CONFIGURED, not a crash", async () => {
    // (challenge browsing is covered below; it must work even unconfigured)
    const res = await request(app).post("/api/v1/salesforce/apex/execute").send({ code: "x" });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("NOT_CONFIGURED");
  });

  it("lets anyone browse challenges with no Clerk, database or Salesforce configured", async () => {
    const { ChallengeService } = await import("../src/services/challenges/challenge.service.ts");
    const { ChallengeCatalog } = await import("../src/services/challenges/catalog.ts");
    const { PROBLEMS_DIR } = await import("../src/container.ts");
    const local = buildApp({ challenges: new ChallengeService(ChallengeCatalog.load(PROBLEMS_DIR), undefined, undefined, { now: () => new Date(), nowMs: () => Date.now() }) });
    const list = await request(local).get("/api/v1/challenges");
    expect(list.status).toBe(200);
    expect(list.body.data.challenges.length).toBeGreaterThan(0);
    expect((await request(local).get("/api/v1/challenges/text-utils")).status).toBe(200);
    const submit = await request(local).post("/api/v1/challenges/text-utils/submissions").send({ files: { SfcTextUtils: "x" } });
    expect(submit.status).toBe(503);
    expect(submit.body.error.message).toMatch(/Sign-in/);
  });

  it("returns the error envelope for unknown routes", async () => {
    const res = await request(app).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
  });
});

describe("rate limiting", () => {
  it("counts addresses in one IPv6 /56 as the same client", async () => {
    const { CertificationService } = await import("../src/services/certification/certification.service.ts");
    const { QuestionBank } = await import("../src/services/certification/bank.ts");
    const { CERTIFICATION_DIR } = await import("../src/container.ts");
    const express = (await import("express")).default;
    const outer = express();
    // Let each request claim a different address inside the same /56.
    outer.set("trust proxy", true);
    outer.use(buildApp({ certification: new CertificationService(QuestionBank.load(CERTIFICATION_DIR), undefined) }));
    const statuses: number[] = [];
    for (let i = 0; i < 62; i++) {
      const res = await request(outer)
        .post("/api/v1/certification/answers")
        .set("X-Forwarded-For", `2001:db8:0:1::${(i + 1).toString(16)}`)
        .send({ questionId: "pd1-limits-soql", selected: ["b"] });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });
});
