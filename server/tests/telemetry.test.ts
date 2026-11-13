import { describe, expect, it } from "vitest";
import { cleanPath, clip, fingerprint, scrub } from "../src/domain/telemetry.ts";

describe("telemetry privacy rules", () => {
  it("scrubs emails, query strings and token-like strings", () => {
    expect(scrub("failed for ada@example.com")).toBe("failed for [email]");
    expect(scrub("GET https://sf.bighnesh.space/x?code=abc&state=def failed")).toBe("GET https://sf.bighnesh.space/x failed");
    expect(scrub("at https://x.dev/a.js#frag:1:2")).toBe("at https://x.dev/a.js");
    expect(scrub("session eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 expired")).toBe("session [token] expired");
    expect(scrub("Cannot read properties of null (reading 'click')")).toBe("Cannot read properties of null (reading 'click')");
  });

  it("clips long text", () => {
    expect(clip("abcdef", 4)).toBe("abc…");
    expect(clip("abc", 4)).toBe("abc");
  });

  it("keeps clean page paths and drops the rest", () => {
    expect(cleanPath("/problems?track=soql#x")).toBe("/problems");
    expect(cleanPath("/challenges/text-utils/")).toBe("/challenges/text-utils");
    expect(cleanPath("/")).toBe("/");
    expect(cleanPath("/backend/api/v1/me")).toBeNull();
    expect(cleanPath("/api/v1/me")).toBeNull();
    expect(cleanPath("https://evil.example/")).toBeNull();
    expect(cleanPath("//evil.example/")).toBeNull();
    expect(cleanPath("/<script>")).toBeNull();
    expect(cleanPath(`/${"a".repeat(200)}`)).toBeNull();
  });
});

describe("fingerprint", () => {
  const stackA = "TypeError: x\n    at handleClick (https://sf.bighnesh.space/_next/static/chunks/page-1a2b3c4d5e.js:10:20)";
  const stackB = "TypeError: x\n    at handleClick (https://sf.bighnesh.space/_next/static/chunks/page-9f8e7d6c5b.js:12:5)";

  it("groups the same bug across deploys, line numbers and varying values", () => {
    expect(fingerprint("client", "TypeError", "Cannot read 'a' of item 3", stackA)).toBe(fingerprint("client", "TypeError", "Cannot read 'b' of item 41", stackB));
  });

  it("separates different bugs and different sources", () => {
    const base = fingerprint("client", "TypeError", "boom", stackA);
    expect(fingerprint("client", "RangeError", "boom", stackA)).not.toBe(base);
    expect(fingerprint("server", "TypeError", "boom", stackA)).not.toBe(base);
    expect(fingerprint("client", "TypeError", "other", stackA)).not.toBe(base);
    expect(fingerprint("client", "TypeError", "boom", stackA.replace("handleClick", "submit"))).not.toBe(base);
  });
});

import type { ErrorGroup, ErrorInput, TelemetryRepository } from "../src/repositories/telemetry.repository.ts";
import { MAX_REPORTS_PER_HOUR, TelemetryService } from "../src/services/telemetry/telemetry.service.ts";
import type { AdminService } from "../src/services/admin/admin.service.ts";
import { errorHandler, setErrorSink } from "../src/middleware/errorHandler.ts";
import { NotFoundError } from "../src/errors/AppError.ts";
import { fixedClock } from "./fakes.ts";

class MemoryTelemetry implements TelemetryRepository {
  errorsSeen: ErrorInput[] = [];
  views_: { day: string; path: string; views: number }[] = [];
  fail = false;
  recordError(e: ErrorInput) {
    if (this.fail) return Promise.reject(new Error("db down"));
    this.errorsSeen.push(e);
    return Promise.resolve();
  }
  errors(): Promise<ErrorGroup[]> {
    return Promise.resolve([]);
  }
  resolve() {
    return Promise.resolve(false);
  }
  countView(day: string, path: string) {
    const row = this.views_.find((v) => v.day === day && v.path === path);
    if (row) row.views++;
    else this.views_.push({ day, path, views: 1 });
    return Promise.resolve();
  }
  views(since: string) {
    return Promise.resolve(this.views_.filter((v) => v.day >= since));
  }
}

const admins = (who: string[]) =>
  ({
    require: (actor: string) => (who.includes(actor) ? Promise.resolve("admin") : Promise.reject(new Error("Admin access required."))),
    record: () => Promise.resolve(),
  }) as unknown as AdminService;

describe("TelemetryService", () => {
  it("scrubs and clips before storing, and keeps the path clean", async () => {
    const repo = new MemoryTelemetry();
    const t = new TelemetryService(repo, admins([]), fixedClock());
    await t.report({ source: "client", name: "TypeError", message: `bad for ada@example.com ${"x".repeat(900)}`, stack: "at f (https://a.dev/x.js?token=abc:1:2)", path: "/problems?q=secret", userAgent: "UA", userId: "u1" });
    const e = repo.errorsSeen[0];
    expect(e?.message.startsWith("bad for [email]")).toBe(true);
    expect(e?.message.length).toBeLessThanOrEqual(500);
    expect(e?.stack).not.toContain("token=abc");
    expect(e?.path).toBe("/problems");
    expect(e?.fingerprint).toMatch(/^[0-9a-f]{32}$/);
  });

  it("never throws, and stops storing after the hourly cap", async () => {
    const repo = new MemoryTelemetry();
    const clock = fixedClock();
    const t = new TelemetryService(repo, admins([]), clock);
    for (let i = 0; i < MAX_REPORTS_PER_HOUR + 5; i++) await t.report({ source: "client", name: "E", message: `m${i}` });
    expect(repo.errorsSeen).toHaveLength(MAX_REPORTS_PER_HOUR);
    clock.advance(3_600_001);
    await t.report({ source: "client", name: "E", message: "after" });
    expect(repo.errorsSeen).toHaveLength(MAX_REPORTS_PER_HOUR + 1);
    repo.fail = true;
    await expect(t.report({ source: "server", name: "E", message: "db down" })).resolves.toBeUndefined();
  });

  it("counts views per day and path, ignoring API paths; analytics is staff-only", async () => {
    const repo = new MemoryTelemetry();
    const t = new TelemetryService(repo, admins(["boss"]), fixedClock(Date.UTC(2026, 10, 13, 12)));
    await t.pageView("/problems?track=soql");
    await t.pageView("/problems");
    await t.pageView("/backend/api/v1/me");
    await t.pageView("/");
    const a = await t.analytics("boss");
    expect(a.total).toBe(3);
    expect(a.pages).toEqual([{ path: "/problems", views: 2 }, { path: "/", views: 1 }]);
    expect(a.days).toHaveLength(30);
    expect(a.days.at(-1)).toEqual({ day: "2026-11-13", views: 3 });
    await expect(t.analytics("nobody")).rejects.toThrow(/Admin/);
    await expect(t.errors("nobody", true)).rejects.toThrow(/Admin/);
  });
});

describe("error handler", () => {
  it("hands 5xx errors to the sink with the original stack; 4xx are not reported", () => {
    const seen: { name: string; message: string; path: string }[] = [];
    setErrorSink((e) => seen.push(e));
    const res = { headersSent: false, setHeader: () => undefined, status() { return this; }, json() { return this; } };
    const req = { path: "/api/v1/x", method: "GET", originalUrl: "/api/v1/x", id: "r1" };
    errorHandler(new TypeError("kaboom"), req as never, res as never, () => undefined);
    errorHandler(new NotFoundError("nope"), req as never, res as never, () => undefined);
    setErrorSink(undefined);
    expect(seen.map((s) => [s.name, s.message, s.path])).toEqual([["TypeError", "kaboom", "/api/v1/x"]]);
  });
});
