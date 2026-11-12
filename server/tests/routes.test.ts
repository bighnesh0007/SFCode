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
    const res = await request(app).post("/api/v1/salesforce/apex/execute").send({ code: "x" });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("NOT_CONFIGURED");
  });

  it("returns the error envelope for unknown routes", async () => {
    const res = await request(app).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
  });
});
