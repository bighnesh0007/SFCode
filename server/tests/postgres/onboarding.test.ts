/** The onboarding repository's jsonb read-marks against a real database. Skipped without TEST_DATABASE_URL. */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgDatabase, type PgDatabase } from "../../src/data/postgres/client.ts";
import { PgOnboardingRepository } from "../../src/repositories/onboarding.repository.ts";

const url = process.env.TEST_DATABASE_URL;
const safe = url !== undefined && new URL(url).pathname.endsWith("_test");

describe.skipIf(!safe)("PgOnboardingRepository", () => {
  let db: PgDatabase;
  let repo: PgOnboardingRepository;
  const answers = { userId: "u", role: "developer", level: "new", goal: "pd1", hours: "3-5", roadmapId: "developer" };

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
    repo = new PgOnboardingRepository(db);
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE user_onboarding`);
  });

  it("marks are a set, survive redoing the quiz, and parallel marks aren't lost", async () => {
    expect(await repo.setRead("u", "a", true)).toBeNull();
    await repo.save(answers);
    await Promise.all(["a", "b", "c", "a"].map((n) => repo.setRead("u", n, true)));
    expect((await repo.get("u"))?.readNodes.sort()).toEqual(["a", "b", "c"]);
    await repo.setRead("u", "b", false);
    await repo.save({ ...answers, level: "production" });
    const row = await repo.get("u");
    expect(row?.level).toBe("production");
    expect(row?.readNodes.sort()).toEqual(["a", "c"]);
  });
});
