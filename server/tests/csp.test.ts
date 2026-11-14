import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.ts";
import { logger } from "../src/lib/logger.ts";

const app = buildApp({});

describe("CSP violation reports", () => {
  afterEach(() => vi.restoreAllMocks());

  it("accepts the classic report-uri format and logs the essentials without query strings", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const res = await request(app)
      .post("/api/v1/telemetry/csp")
      .set("Content-Type", "application/csp-report")
      .send(JSON.stringify({ "csp-report": { "document-uri": "https://sf.bighnesh.space/lwc/x?token=secret", "effective-directive": "script-src-elem", "blocked-uri": "https://evil.example/a.js?q=1" } }));
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledWith({ event: "csp.violation", directive: "script-src-elem", blocked: "https://evil.example/a.js", page: "https://sf.bighnesh.space/lwc/x", source: undefined }, "csp violation");
  });

  it("accepts the Reporting API format (an array of reports)", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const res = await request(app)
      .post("/api/v1/telemetry/csp")
      .set("Content-Type", "application/reports+json")
      .send(JSON.stringify([{ type: "csp-violation", body: { documentURL: "https://sf.bighnesh.space/", effectiveDirective: "img-src", blockedURL: "https://img.example/p.png" } }]));
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ directive: "img-src", blocked: "https://img.example/p.png", page: "https://sf.bighnesh.space/" }), "csp violation");
  });

  it("tolerates empty reports and rejects non-JSON", async () => {
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const empty = await request(app).post("/api/v1/telemetry/csp").set("Content-Type", "application/csp-report").send("{}");
    expect(empty.status).toBe(204);
    const junk = await request(app).post("/api/v1/telemetry/csp").set("Content-Type", "application/csp-report").send("not json");
    expect(junk.status).toBe(400);
  });
});
