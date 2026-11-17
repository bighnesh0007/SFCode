/** The auto-contest scheduler against a real database. Skipped without TEST_DATABASE_URL. */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgDatabase, type PgDatabase } from "../../src/data/postgres/client.ts";
import { PROBLEMS_DIR } from "../../src/container.ts";
import { PgAdminRepository } from "../../src/repositories/admin.repository.ts";
import { PgChallengeSubmissionRepository } from "../../src/repositories/challengeSubmission.repository.ts";
import { PgContestRepository } from "../../src/repositories/contest.repository.ts";
import { PgProfileRepository } from "../../src/repositories/profile.repository.ts";
import { PgSettingsRepository } from "../../src/repositories/settings.repository.ts";
import { AdminService } from "../../src/services/admin/admin.service.ts";
import { ChallengeCatalog } from "../../src/services/challenges/catalog.ts";
import { CommunityService } from "../../src/services/community/community.service.ts";
import { AutoContestService } from "../../src/services/contests/autoContest.service.ts";
import { ContestService } from "../../src/services/contests/contest.service.ts";
import { fixedClock } from "../fakes.ts";

const url = process.env.TEST_DATABASE_URL;
const safe = url !== undefined && new URL(url).pathname.endsWith("_test");
const DAY = 24 * 3600_000;

describe.skipIf(!safe)("Auto contests on Postgres", () => {
  let db: PgDatabase;
  const catalog = ChallengeCatalog.load(PROBLEMS_DIR);
  let clock: ReturnType<typeof fixedClock>;
  let auto: AutoContestService;
  let contests: ContestService;
  let repo: PgContestRepository;

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE contests, contest_problems, contest_entries, app_settings, user_roles CASCADE`);
    clock = fixedClock(Date.parse("2026-11-17T00:00:00Z"));
    repo = new PgContestRepository(db);
    const profiles = new PgProfileRepository(db);
    const community = new CommunityService(catalog, new PgChallengeSubmissionRepository(db), profiles, { lookup: (id: string) => Promise.resolve({ username: id, displayName: id, imageUrl: null }) }, clock);
    const admin = new AdminService(new PgAdminRepository(db), "owner", clock);
    contests = new ContestService(repo, catalog, profiles, community, admin, clock);
    auto = new AutoContestService(repo, catalog, new PgSettingsRepository(db), clock);
    contests.setOnDelete((slug, by) => auto.remember(slug, by));
  });

  it("creates the next week's contests with four graded problems, once", async () => {
    expect(await auto.ensureUpcoming()).toEqual(["biweekly-contest-1", "weekly-contest-1"]);
    expect(await auto.ensureUpcoming()).toEqual([]);
    const weekly = await repo.findBySlug("weekly-contest-1");
    expect(weekly?.title).toBe("Weekly Contest 1");
    expect(weekly?.startsAt.toISOString()).toBe("2026-11-22T14:30:00.000Z");
    expect(weekly?.problems.map((p) => p.points)).toEqual([10, 20, 20, 40]);
    for (const p of weekly?.problems ?? []) {
      const ch = catalog.get(p.slug);
      expect(["apex", "soql", "debug", "lwc"]).toContain(ch?.track);
    }
    const biweekly = await repo.findBySlug("biweekly-contest-1");
    const shared = (weekly?.problems ?? []).filter((p) => biweekly?.problems.some((q) => q.slug === p.slug));
    expect(shared).toEqual([]); // the second contest avoids the first one's problems
  });

  it("no problem repeats across the first eight contests", async () => {
    const slugs: string[] = [];
    for (let week = 0; week < 6 && slugs.length < 8; week++) {
      slugs.push(...(await auto.ensureUpcoming()));
      clock.advance(7 * DAY);
    }
    const first8 = slugs.slice(0, 8);
    expect(first8).toHaveLength(8);
    const all = (await Promise.all(first8.map((s) => repo.findBySlug(s)))).flatMap((c) => c?.problems.map((p) => p.slug) ?? []);
    expect(new Set(all).size).toBe(all.length);
  });

  it("keeps rolling forward as time passes", async () => {
    await auto.ensureUpcoming();
    clock.advance(7 * DAY);
    expect(await auto.ensureUpcoming()).toEqual(["weekly-contest-2"]);
  });

  it("can be switched off, and a deleted auto contest isn't recreated", async () => {
    await auto.setEnabled(false, "owner");
    expect(await auto.ensureUpcoming()).toEqual([]);
    await auto.setEnabled(true, "owner");
    await auto.ensureUpcoming();
    await contests.remove("owner", "weekly-contest-1");
    expect(await auto.ensureUpcoming()).toEqual([]);
    expect(await repo.findBySlug("weekly-contest-1")).toBeNull();
    expect((await auto.state()).skipped).toEqual(["weekly-contest-1"]);
  });
});
