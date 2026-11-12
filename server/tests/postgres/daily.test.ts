/** Daily Challenge against a real database: the pick is fixed per day, and wins count only same-day solves of that day's problem. */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgDatabase, type PgDatabase } from "../../src/data/postgres/client.ts";
import { PROBLEMS_DIR } from "../../src/container.ts";
import { PgDailyRepository } from "../../src/repositories/daily.repository.ts";
import { ChallengeCatalog } from "../../src/services/challenges/catalog.ts";
import { DAILY_BONUS, DailyService } from "../../src/services/daily/daily.service.ts";
import { fixedClock } from "../fakes.ts";

const url = process.env.TEST_DATABASE_URL;
const safe = url !== undefined && new URL(url).pathname.endsWith("_test");

describe.skipIf(!safe)("DailyService on Postgres", () => {
  let db: PgDatabase;
  const catalog = ChallengeCatalog.load(PROBLEMS_DIR);

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE daily_challenges, challenge_submissions`);
  });

  const submit = (userId: string, slug: string, status: string, at: string) =>
    db.execute(sql`INSERT INTO challenge_submissions (user_id, problem_slug, org_id, status, files, created_at, completed_at) VALUES (${userId}, ${slug}, 'o', ${status}, '{}'::jsonb, ${new Date(at)}, ${new Date(at)})`);

  it("same problem all day for everyone, a scored track, and the first pick sticks", async () => {
    const clock = fixedClock(Date.parse("2026-03-10T08:00:00Z"));
    const svc = new DailyService(new PgDailyRepository(db), catalog, clock);
    const a = await svc.view(null);
    clock.advance(10 * 3600_000); // 18:00, same UTC day
    expect((await svc.view("someone")).problem.slug).toBe(a.problem.slug);
    expect(["apex", "soql", "debug", "flow"]).toContain(a.problem.track);
    expect(a.resetsIn).toBe(16 * 3600);

    await db.execute(sql`INSERT INTO daily_challenges (day, problem_slug) VALUES ('2026-03-11', 'text-utils') ON CONFLICT DO NOTHING`);
    clock.advance(12 * 3600_000);
    expect((await svc.view(null)).problem.slug).toBe("text-utils");
  });

  it("wins: same UTC day, right problem, accepted only; streak and coins follow", async () => {
    const clock = fixedClock(Date.parse("2026-03-12T09:00:00Z"));
    const repo = new PgDailyRepository(db);
    const svc = new DailyService(repo, catalog, clock);
    await db.execute(sql`INSERT INTO daily_challenges (day, problem_slug) VALUES ('2026-03-11', 'text-utils'), ('2026-03-12', 'protect-closed-won')`);

    await submit("u", "text-utils", "accepted", "2026-03-11T23:59:00Z"); // win
    await submit("u", "text-utils", "accepted", "2026-03-12T00:01:00Z"); // wrong day's problem
    await submit("u", "protect-closed-won", "wrong_answer", "2026-03-12T08:00:00Z"); // not accepted
    await submit("u", "protect-closed-won", "accepted", "2026-03-05T10:00:00Z"); // today's problem, solved a week early
    let v = await svc.view("u");
    expect(v).toMatchObject({ solvedToday: false, wins: 1, streak: 1 });

    await submit("u", "protect-closed-won", "accepted", "2026-03-12T08:30:00Z");
    await submit("u", "protect-closed-won", "accepted", "2026-03-12T08:40:00Z"); // twice = still one win
    v = await svc.view("u");
    expect(v).toMatchObject({ solvedToday: true, wins: 2, streak: 2 });
    expect(await svc.coins("u")).toBe(2 * DAILY_BONUS);
    expect(await svc.coins("nobody")).toBe(0);
  });
});
