/** Error grouping and page views on Postgres. Skipped without TEST_DATABASE_URL. */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgDatabase, type PgDatabase } from "../../src/data/postgres/client.ts";
import { MAX_USERS_PER_ERROR } from "../../src/domain/telemetry.ts";
import { PgTelemetryRepository } from "../../src/repositories/telemetry.repository.ts";

const url = process.env.TEST_DATABASE_URL;
const safe = url !== undefined && new URL(url).pathname.endsWith("_test");

describe.skipIf(!safe)("telemetry on Postgres", () => {
  let db: PgDatabase;
  let repo: PgTelemetryRepository;
  const err = (userId: string | null, message = "boom") => ({ fingerprint: "f".repeat(32), source: "client" as const, name: "TypeError", message, stack: null, path: "/p", userAgent: "UA", userId });

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
    repo = new PgTelemetryRepository(db);
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE error_events, page_views`);
  });

  it("groups by fingerprint, counts occurrences and distinct users, keeps the latest details", async () => {
    await repo.recordError(err("u1"));
    await repo.recordError(err("u1"));
    await repo.recordError(err("u2", "boom again"));
    await repo.recordError(err(null, "boom latest"));
    const [g] = await repo.errors({ open: true, limit: 10 });
    expect(g).toMatchObject({ occurrences: 4, users: 2, message: "boom latest" });
  });

  it("caps the stored user list", async () => {
    for (let i = 0; i < MAX_USERS_PER_ERROR + 5; i++) await repo.recordError(err(`u${i}`));
    expect((await repo.errors({ open: true, limit: 10 }))[0]?.users).toBe(MAX_USERS_PER_ERROR);
  });

  it("resolving hides it from the open list; a new occurrence reopens it", async () => {
    await repo.recordError(err("u1"));
    expect(await repo.resolve("f".repeat(32))).toBe(true);
    expect(await repo.resolve("f".repeat(32))).toBe(false);
    expect(await repo.errors({ open: true, limit: 10 })).toHaveLength(0);
    expect(await repo.errors({ open: false, limit: 10 })).toHaveLength(1);
    await repo.recordError(err("u1"));
    expect((await repo.errors({ open: true, limit: 10 }))[0]?.resolvedAt).toBeNull();
  });

  it("counts page views per day and path", async () => {
    await repo.countView("2026-11-12", "/a");
    await repo.countView("2026-11-13", "/a");
    await repo.countView("2026-11-13", "/a");
    await repo.countView("2026-11-13", "/b");
    expect((await repo.views("2026-11-13")).sort((x, y) => x.path.localeCompare(y.path))).toEqual([
      { day: "2026-11-13", path: "/a", views: 2 },
      { day: "2026-11-13", path: "/b", views: 1 },
    ]);
  });
});
