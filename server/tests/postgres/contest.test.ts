/**
 * Contests and the store against a real database: standings (score, penalty,
 * the time window), permissions, prizes feeding the wallet, and a purchase
 * race that must not overspend. Skipped without TEST_DATABASE_URL.
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgDatabase, type PgDatabase } from "../../src/data/postgres/client.ts";
import { PROBLEMS_DIR } from "../../src/container.ts";
import { PgAdminRepository } from "../../src/repositories/admin.repository.ts";
import { PgChallengeSubmissionRepository } from "../../src/repositories/challengeSubmission.repository.ts";
import { PgContestRepository } from "../../src/repositories/contest.repository.ts";
import { PgProfileRepository } from "../../src/repositories/profile.repository.ts";
import { PgStoreRepository } from "../../src/repositories/store.repository.ts";
import { AdminService } from "../../src/services/admin/admin.service.ts";
import { ChallengeCatalog } from "../../src/services/challenges/catalog.ts";
import { CommunityService } from "../../src/services/community/community.service.ts";
import { ContestService, PENALTY_PER_WRONG } from "../../src/services/contests/contest.service.ts";
import { StoreService } from "../../src/services/store/store.service.ts";
import { fixedClock } from "../fakes.ts";

const url = process.env.TEST_DATABASE_URL;
const safe = url !== undefined && new URL(url).pathname.endsWith("_test");
const MIN = 60_000;

describe.skipIf(!safe)("Contests and store on Postgres", () => {
  let db: PgDatabase;
  let contests: ContestService;
  let store: StoreService;
  let repo: PgContestRepository;
  let clock: ReturnType<typeof fixedClock>;
  let admin: AdminService;
  const catalog = ChallengeCatalog.load(PROBLEMS_DIR);
  const apex = catalog.all().filter((p) => p.track === "apex").map((p) => p.slug);
  const p1 = apex[0] ?? "";
  const p2 = apex[1] ?? "";

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE contests, contest_problems, contest_entries, challenge_submissions, store_purchases, user_equipped, user_profiles, user_roles CASCADE`);
    clock = fixedClock(Date.UTC(2026, 0, 1));
    const profiles = new PgProfileRepository(db);
    const identity = { lookup: (id: string) => Promise.resolve({ username: id, displayName: id, imageUrl: null }) };
    const subs = new PgChallengeSubmissionRepository(db);
    const community = new CommunityService(catalog, subs, profiles, identity, clock);
    admin = new AdminService(new PgAdminRepository(db), "owner", clock);
    repo = new PgContestRepository(db);
    contests = new ContestService(repo, catalog, profiles, community, admin, clock);
    store = new StoreService(new PgStoreRepository(db), subs, catalog, contests);
    community.setCosmeticsSource(store);
  });

  async function submit(userId: string, slug: string, status: string, at: number, contestId: string | null) {
    await db.execute(sql`INSERT INTO challenge_submissions (user_id, problem_slug, org_id, status, files, created_at, completed_at, contest_id)
      VALUES (${userId}, ${slug}, 'org', ${status}, '{}'::jsonb, ${new Date(at)}, ${new Date(at)}, ${contestId})`);
  }

  async function liveContest() {
    const start = clock.nowMs() + 60 * MIN;
    const c = await contests.create("owner", { title: "Weekly One", startsAt: new Date(start), endsAt: new Date(start + 90 * MIN), problems: [{ slug: p1, points: 100 }, { slug: p2, points: 50 }] });
    return { c, start };
  }

  it("only admins create; problems hidden until start; join only while not ended", async () => {
    await expect(contests.create("bob", { title: "Nope", startsAt: new Date(clock.nowMs() + MIN * 60), endsAt: new Date(clock.nowMs() + MIN * 120), problems: [{ slug: p1, points: 10 }] })).rejects.toMatchObject({ status: 403 });
    const { c } = await liveContest();
    expect((await contests.get(c.slug, "bob")).problems).toEqual([]);
    expect((await contests.get(c.slug, "owner")).problems).toHaveLength(2);
    await contests.join("bob", c.slug);
    clock.advance(200 * MIN);
    await expect(contests.join("carol", c.slug)).rejects.toThrow();
    await expect(contests.remove("owner", c.slug)).rejects.toThrow();
  });

  it("ranks by score then penalty; ignores out-of-window attempts; never exposes user ids", async () => {
    const { c, start } = await liveContest();
    clock.advance(61 * MIN);
    await contests.join("alice", c.slug);
    await contests.join("bob", c.slug);
    const id = (await repo.findBySlug(c.slug))!.id;
    expect(await repo.liveContestFor("alice", p1, clock.now())).toBe(id);
    expect(await repo.liveContestFor("carol", p1, clock.now())).toBeNull();

    await submit("alice", p1, "wrong_answer", start + 5 * MIN, id);
    await submit("alice", p1, "error", start + 6 * MIN, id); // infra: free
    await submit("alice", p1, "accepted", start + 10 * MIN, id);
    await submit("bob", p1, "accepted", start + 20 * MIN, id);
    await submit("bob", p2, "accepted", start + 200 * MIN, id); // after end: ignored
    const v = await contests.get(c.slug, null);
    expect(v.standings.map((r) => [r.handle, r.score, r.penalty])).toEqual([
      ["alice", 100, 10 + PENALTY_PER_WRONG],
      ["bob", 100, 20],
    ]);
    expect(JSON.stringify(v)).not.toContain('"userId"');

    expect(await contests.history("bob")).toEqual([]); // still live
    clock.advance(200 * MIN);
    expect(await contests.history("bob")).toEqual([expect.objectContaining({ slug: c.slug, rank: 2, entrants: 2, score: 100 })]);
    expect(await contests.history("carol")).toEqual([]);
  });

  it("the purchase lock stops parallel buys from overspending", async () => {
    const repo = new PgStoreRepository(db);
    const out = await Promise.all(Array.from({ length: 12 }, (_, i) => repo.purchase("dave", `item-${i}`, 10, 30)));
    expect(out.filter((o) => o === "bought")).toHaveLength(3);
    expect(await repo.spent("dave")).toBe(30);
  });

  it("prizes add to the wallet; concurrent buys never overspend", async () => {
    const { c, start } = await liveContest();
    clock.advance(61 * MIN);
    await contests.join("alice", c.slug);
    const id = (await repo.findBySlug(c.slug))!.id;
    await submit("alice", p1, "accepted", start + 5 * MIN, id);
    clock.advance(100 * MIN);
    const wallet = await store.wallet("alice");
    expect(wallet.earnedFromContests).toBe(100);
    expect(wallet.balance).toBeGreaterThanOrEqual(110);

    // The duplicate frame-sky must lose: exactly 30 + 60 spent.
    const results = await Promise.allSettled([store.buy("alice", "frame-sky"), store.buy("alice", "frame-sky"), store.buy("alice", "accent-emerald")]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(2);
    const after = await store.wallet("alice");
    expect(after.balance).toBe(wallet.balance - 90);
    expect(after.balance).toBeGreaterThanOrEqual(0);

    // Leave exactly 60 coins, then race two different 60-coin items: one must lose.
    await db.execute(sql`INSERT INTO store_purchases (user_id, item_id, price) VALUES ('alice', 'legacy-test', ${after.balance - 60})`);
    const race = await Promise.allSettled([store.buy("alice", "accent-violet"), store.buy("alice", "badge-soql"), store.buy("alice", "badge-flow")]);
    expect((await store.wallet("alice")).balance).toBeGreaterThanOrEqual(0);
    expect(race.filter((r) => r.status === "fulfilled").length).toBe(1);

    await store.equip("alice", "frame-sky", true);
    await expect(store.equip("alice", "frame-gold", true)).rejects.toThrow();
    expect((await store.cosmetics(["alice"])).get("alice")).toMatchObject({ frame: expect.any(String) });
  });

  it("firstSolves can be scoped to one user", async () => {
    await submit("alice", p1, "accepted", clock.nowMs(), null);
    await submit("bob", p1, "accepted", clock.nowMs(), null);
    const subs = new PgChallengeSubmissionRepository(db);
    expect((await subs.firstSolves()).length).toBe(2);
    expect((await subs.firstSolves(undefined, "bob")).map((r) => r.userId)).toEqual(["bob"]);
  });

  it("results are cached only once a contest has settled", async () => {
    const { c, start } = await liveContest();
    clock.advance(61 * MIN);
    await contests.join("alice", c.slug);
    const id = (await repo.findBySlug(c.slug))?.id ?? null;
    clock.advance(100 * MIN); // ended 10 minutes ago: not settled
    expect((await contests.history("alice"))[0]?.score).toBe(0);
    // A late-graded in-window solve still counts before settling…
    await submit("alice", p1, "accepted", start + 30 * MIN, id);
    expect((await contests.history("alice"))[0]?.score).toBe(100);
    clock.advance(60 * MIN); // settled: cached from here
    expect((await contests.history("alice"))[0]?.score).toBe(100);
    await submit("alice", p2, "accepted", start + 40 * MIN, id);
    expect((await contests.history("alice"))[0]?.score).toBe(100);
  });
});
