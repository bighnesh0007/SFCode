/** Weekly digest caps and scheduling on Postgres, with a fake sender. Skipped without TEST_DATABASE_URL. */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgDatabase, type PgDatabase } from "../../src/data/postgres/client.ts";
import { PgEmailRepository } from "../../src/repositories/email.repository.ts";
import { DigestService, isoWeek, monthStart, renderDigest, type DigestContent } from "../../src/services/email/digest.service.ts";
import { fixedClock } from "../fakes.ts";

const url = process.env.TEST_DATABASE_URL;
const safe = url !== undefined && new URL(url).pathname.endsWith("_test");
const content: DigestContent = { name: "Ada", rank: "Ranger", points: 42, streak: 3, daily: { title: "Text Utilities", url: "https://x/problems" }, contests: [] };

describe("digest helpers", () => {
  it("ISO weeks, including the year boundary", () => {
    expect(isoWeek(new Date("2026-11-16T10:00:00Z"))).toBe("2026-W47");
    expect(isoWeek(new Date("2026-01-01T10:00:00Z"))).toBe("2026-W01");
    expect(isoWeek(new Date("2027-01-01T10:00:00Z"))).toBe("2026-W53");
  });
  it("escapes everything user-controlled", () => {
    const { html, subject } = renderDigest({ ...content, name: '<img src=x onerror="alert(1)">' }, "https://sf.example");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(subject).toContain("Ranger");
  });
});

describe.skipIf(!safe)("weekly digest on Postgres", () => {
  let db: PgDatabase;
  let repo: PgEmailRepository;
  const monday9 = Date.parse("2026-11-16T09:30:00Z");

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE email_prefs, email_log`);
    repo = new PgEmailRepository(db);
  });

  function setup(at: number, caps = { total: 190, perUser: 4 }, fail = false) {
    const sent: string[] = [];
    const clock = fixedClock(at);
    const svc = new DigestService(
      repo,
      { send: (to) => (fail ? Promise.reject(new Error("boom")) : (sent.push(to), Promise.resolve())) },
      { email: (id) => Promise.resolve(id === "noaddr" ? null : `${id}@example.com`), content: () => Promise.resolve(content) },
      clock,
      caps,
      "https://sf.example",
    );
    return { svc, sent, clock };
  }

  it("opt-in only; Mondays from 09:00 UTC; once per user per week", async () => {
    await repo.setPrefs("ann", true);
    await repo.setPrefs("bob", false);
    expect(await setup(Date.parse("2026-11-16T08:59:00Z")).svc.runWeekly()).toEqual({}); // too early
    expect(await setup(Date.parse("2026-11-17T10:00:00Z")).svc.runWeekly()).toEqual({}); // Tuesday
    const a = setup(monday9);
    expect(await a.svc.runWeekly()).toEqual({ sent: 1 });
    expect(a.sent).toEqual(["ann@example.com"]);
    expect(await setup(monday9 + 3600_000).svc.runWeekly()).toEqual({ duplicate: 1 }); // the hourly re-run sends nothing
  });

  it("per-user and total monthly caps; failures still count", async () => {
    for (const u of ["u1", "u2", "u3"]) await repo.setPrefs(u, true);
    expect(await setup(monday9, { total: 2, perUser: 4 }).svc.runWeekly()).toEqual({ sent: 2, global_cap: 1 });
    await db.execute(sql`TRUNCATE email_log`);
    for (let i = 0; i < 2; i++) expect(await repo.claim("u1", "test", `p${i}`, monthStart(new Date(monday9)), { total: 190, perUser: 2 })).toBe("claimed");
    expect(await repo.claim("u1", "test", "p9", monthStart(new Date(monday9)), { total: 190, perUser: 2 })).toBe("user_cap");
    await db.execute(sql`TRUNCATE email_log`);
    const f = setup(monday9, { total: 190, perUser: 4 }, true);
    expect(await f.svc.runWeekly()).toEqual({ failed: 3 });
    expect(await repo.sentThisMonth(monthStart(new Date(monday9)))).toBe(3);
  });

  it("parallel runs can't overshoot the total cap", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => repo.claim(`p${i}`, "digest", "2026-W47", monthStart(new Date(monday9)), { total: 4, perUser: 4 })));
    expect(results.filter((r) => r === "claimed")).toHaveLength(4);
  });

  it("users without a verified address are skipped without using the budget", async () => {
    await repo.setPrefs("noaddr", true);
    expect(await setup(monday9).svc.runWeekly()).toEqual({ no_address: 1 });
    expect(await repo.sentThisMonth(monthStart(new Date(monday9)))).toBe(0);
  });
});
