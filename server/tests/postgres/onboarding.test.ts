/** The onboarding repository's jsonb read-marks against a real database. Skipped without TEST_DATABASE_URL. */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgDatabase, type PgDatabase } from "../../src/data/postgres/client.ts";
import { EMPTY_ABOUT, PgAboutRepository } from "../../src/repositories/about.repository.ts";
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
    await db.execute(sql`TRUNCATE user_onboarding, user_about`);
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

  it("about: save, overwrite, and read many", async () => {
    const about = new PgAboutRepository(db);
    expect(await about.get("u")).toBeNull();
    await about.save("u", { ...EMPTY_ABOUT, bio: "Hi", certifications: ["Platform Developer I"], openToWork: true });
    await about.save("u", { ...EMPTY_ABOUT, bio: "Hello", githubUrl: "https://github.com/u" });
    await about.save("v", { ...EMPTY_ABOUT, company: "Acme" });
    const many = await about.getMany(["u", "v", "w"]);
    expect(many.get("u")).toEqual({ ...EMPTY_ABOUT, bio: "Hello", githubUrl: "https://github.com/u" });
    expect(many.get("v")?.company).toBe("Acme");
    expect(many.has("w")).toBe(false);
  });
});
