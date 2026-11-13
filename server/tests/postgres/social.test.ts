/** Follows, feed and notifications on Postgres. Skipped without TEST_DATABASE_URL. */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgDatabase, type PgDatabase } from "../../src/data/postgres/client.ts";
import { PROBLEMS_DIR } from "../../src/container.ts";
import { PgChallengeSubmissionRepository } from "../../src/repositories/challengeSubmission.repository.ts";
import { PgProfileRepository } from "../../src/repositories/profile.repository.ts";
import { PgSocialRepository } from "../../src/repositories/social.repository.ts";
import { ChallengeCatalog } from "../../src/services/challenges/catalog.ts";
import { CommunityService } from "../../src/services/community/community.service.ts";
import { PointsService } from "../../src/services/points/points.service.ts";
import { SocialService } from "../../src/services/social/social.service.ts";
import { fixedClock } from "../fakes.ts";

const url = process.env.TEST_DATABASE_URL;
const safe = url !== undefined && new URL(url).pathname.endsWith("_test");
const DAY = 86_400_000;

describe.skipIf(!safe)("social on Postgres", () => {
  let db: PgDatabase;
  let social: SocialService;
  const clock = fixedClock(Date.UTC(2026, 10, 13, 12));

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE follows, notifications, user_profiles, challenge_submissions`);
    const profiles = new PgProfileRepository(db);
    const subs = new PgChallengeSubmissionRepository(db);
    const catalog = ChallengeCatalog.load(PROBLEMS_DIR);
    const identity = { lookup: (id: string) => Promise.resolve({ username: id, displayName: id.toUpperCase(), imageUrl: null }) };
    const community = new CommunityService(catalog, subs, profiles, identity, clock);
    for (const u of ["ann", "bob", "cyd"]) await community.ensureProfile(u);
    social = new SocialService(new PgSocialRepository(db), profiles, community, subs, catalog, new PointsService(undefined, undefined), clock);
    social.setSources({
      communityProblems: () => Promise.resolve([{ slug: "double-it", title: "Double It", track: "apex", difficulty: "Easy", authorId: "cyd", publishedAt: new Date(clock.nowMs() - DAY) }]),
      posts: () => Promise.resolve([{ slug: "hello", title: "Hello world", authorHandle: "bob", createdAt: new Date(clock.nowMs() - 2 * DAY).toISOString() }]),
    });
  });

  const solve = (userId: string, slug: string, daysAgo: number) =>
    db.execute(sql`INSERT INTO challenge_submissions (user_id, problem_slug, org_id, status, files, created_at, completed_at) VALUES (${userId}, ${slug}, 'o', 'accepted', '{}'::jsonb, ${new Date(clock.nowMs() - daysAgo * DAY)}, ${new Date(clock.nowMs() - daysAgo * DAY)})`);

  it("follow, unfollow, counts; no self-follow; a repeat follow notifies once", async () => {
    await expect(social.follow("ann", "ann", true)).rejects.toMatchObject({ status: 400 });
    expect(await social.follow("ann", "bob", true)).toMatchObject({ followers: 1, isFollowing: true });
    await social.follow("ann", "bob", true);
    const n = await social.notifications("bob");
    expect(n.unread).toBe(1);
    expect(n.items[0]).toMatchObject({ kind: "follow", data: { handle: "ann" } });
    expect(await social.socialFor("ann", "ann")).toMatchObject({ following: 1, followers: 0, isMe: true });
    expect(await social.follow("ann", "bob", false)).toMatchObject({ followers: 0, isFollowing: false });
    await social.markAllRead("bob");
    expect(await social.unread("bob")).toBe(0);
  });

  it("feed: everyone sees all; following shows only followed people and you; rank-ups are derived", async () => {
    // bob: three Apex Easy (3 each) = 9, then a Medium (6) = 15, crossing Trailblazer (10) yesterday.
    await solve("bob", "text-utils", 30);
    await solve("bob", "account-rating-default", 20);
    await solve("bob", "protect-closed-won", 3);
    await solve("bob", "won-revenue-rollup", 1);
    await solve("cyd", "soql-hot-tech-accounts", 2);

    const everyone = await social.feed(null, "everyone");
    const kinds = everyone.map((i) => `${i.kind}:${i.actor.handle}`);
    expect(kinds).toEqual(expect.arrayContaining(["rank:bob", "solve:bob", "solve:cyd", "problem:cyd", "post:bob"]));
    expect(everyone.find((i) => i.kind === "rank")).toMatchObject({ rank: { id: "trailblazer" } });
    expect(everyone.filter((i) => i.kind === "solve" && i.actor.handle === "bob")).toHaveLength(2);
    expect(everyone.map((i) => i.at)).toEqual([...everyone.map((i) => i.at)].sort().reverse());

    await social.follow("ann", "bob", true);
    const mine = await social.feed("ann", "following");
    expect(new Set(mine.map((i) => i.actor.handle))).toEqual(new Set(["bob"]));
    expect(mine.map((i) => i.kind)).toContain("post");
  });
});
