/** Teams, mentors and jobs on Postgres. Skipped without TEST_DATABASE_URL. */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgDatabase, type PgDatabase } from "../../src/data/postgres/client.ts";
import { PROBLEMS_DIR } from "../../src/container.ts";
import { PgAboutRepository, EMPTY_ABOUT } from "../../src/repositories/about.repository.ts";
import { PgAdminRepository } from "../../src/repositories/admin.repository.ts";
import { PgChallengeSubmissionRepository } from "../../src/repositories/challengeSubmission.repository.ts";
import { PgHubRepository } from "../../src/repositories/hub.repository.ts";
import { PgProfileRepository } from "../../src/repositories/profile.repository.ts";
import { PgSocialRepository } from "../../src/repositories/social.repository.ts";
import { AdminService } from "../../src/services/admin/admin.service.ts";
import { ChallengeCatalog } from "../../src/services/challenges/catalog.ts";
import { CommunityService } from "../../src/services/community/community.service.ts";
import { HubService, MAX_OWNED_TEAMS } from "../../src/services/hub/hub.service.ts";
import { PointsService } from "../../src/services/points/points.service.ts";
import { SocialService } from "../../src/services/social/social.service.ts";
import { fixedClock } from "../fakes.ts";

const url = process.env.TEST_DATABASE_URL;
const safe = url !== undefined && new URL(url).pathname.endsWith("_test");

describe.skipIf(!safe)("teams, mentors, jobs on Postgres", () => {
  let db: PgDatabase;
  let hub: HubService;
  let social: SocialService;
  const clock = fixedClock(Date.UTC(2026, 10, 13, 12));

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE teams, team_members, mentors, jobs, user_profiles, user_roles, user_about, notifications, challenge_submissions CASCADE`);
    const profiles = new PgProfileRepository(db);
    const subs = new PgChallengeSubmissionRepository(db);
    const catalog = ChallengeCatalog.load(PROBLEMS_DIR);
    const community = new CommunityService(catalog, subs, profiles, { lookup: (id: string) => Promise.resolve({ username: id, displayName: id.toUpperCase(), imageUrl: null }) }, clock);
    for (const u of ["ann", "bob", "cyd"]) await community.ensureProfile(u);
    social = new SocialService(new PgSocialRepository(db), profiles, community, subs, catalog, new PointsService(undefined, undefined), clock);
    hub = new HubService(new PgHubRepository(db), profiles, community, new AdminService(new PgAdminRepository(db), "owner", clock), social, clock);
  });

  const solve = (userId: string, slug: string) =>
    db.execute(sql`INSERT INTO challenge_submissions (user_id, problem_slug, org_id, status, files, created_at, completed_at) VALUES (${userId}, ${slug}, 'o', 'accepted', '{}'::jsonb, now(), now())`);

  it("teams: create, join by code, private board sorted by points; owner-only code; owner limit", async () => {
    const t = await hub.createTeam("ann", "Pune Trailblazers");
    expect(t.owner).toBe(true);
    const code = t.joinCode ?? "";
    expect(code).toMatch(/^[A-Z0-9]{8}$/);
    await expect(hub.team("bob", t.slug)).rejects.toMatchObject({ status: 403 }); // not a member yet
    await solve("bob", "won-revenue-rollup"); // 6 points
    const joined = await hub.join("bob", code.toLowerCase());
    expect(joined.joinCode).toBeNull(); // members don't see the code
    expect(joined.members.map((m) => [m.handle, m.points, m.place])).toEqual([["bob", 6, 1], ["ann", 0, 2]]);
    expect((await social.notifications("ann")).items[0]).toMatchObject({ kind: "team", data: { handle: "bob" } });
    const rotated = await hub.rotateCode("ann", t.slug);
    expect(rotated.joinCode).not.toBe(code);
    await expect(hub.join("cyd", code)).rejects.toMatchObject({ status: 404 }); // old code is dead
    await expect(hub.rotateCode("bob", t.slug)).rejects.toMatchObject({ status: 403 });
    for (let i = 1; i < MAX_OWNED_TEAMS; i++) await hub.createTeam("ann", `Team ${i}`);
    await expect(hub.createTeam("ann", "One too many")).rejects.toMatchObject({ status: 409 });
    await hub.leave("bob", t.slug);
    expect((await hub.myTeams("bob")).length).toBe(0);
  });

  it("public team board: only teams their owner listed; owner-only switch; no member ids", async () => {
    const a = await hub.createTeam("ann", "Listed Team");
    const b = await hub.createTeam("cyd", "Private Team");
    await hub.join("bob", a.joinCode ?? "");
    await solve("bob", "won-revenue-rollup"); // 6
    await solve("cyd", "text-utils"); // 3
    expect(await hub.teamBoard()).toEqual([]);
    await expect(hub.setListed("bob", a.slug, true)).rejects.toMatchObject({ status: 403 });
    expect((await hub.setListed("ann", a.slug, true)).listed).toBe(true);
    const board = await hub.teamBoard();
    expect(board).toEqual([{ rank: 1, slug: a.slug, name: "Listed Team", members: 2, score: 6, solved: 1 }]);
    expect(JSON.stringify(board)).not.toMatch(/ann|bob|cyd/);
    await hub.setListed("cyd", b.slug, true);
    expect((await hub.teamBoard()).map((t) => [t.name, t.score])).toEqual([["Listed Team", 6], ["Private Team", 3]]);
  });

  it("country board and the points board filtered by country", async () => {
    const about = new PgAboutRepository(db);
    const profiles = new PgProfileRepository(db);
    const subs = new PgChallengeSubmissionRepository(db);
    const catalog = ChallengeCatalog.load(PROBLEMS_DIR);
    const community = new CommunityService(catalog, subs, profiles, { lookup: (id: string) => Promise.resolve({ username: id, displayName: id.toUpperCase(), imageUrl: null }) }, fixedClock(Date.UTC(2026, 10, 13, 12)), about);
    await community.updateAbout("ann", { ...EMPTY_ABOUT, country: "IN" });
    await community.updateAbout("bob", { ...EMPTY_ABOUT, country: "IN" });
    await community.updateAbout("cyd", { ...EMPTY_ABOUT, country: "DE" });
    await solve("ann", "won-revenue-rollup"); // 6
    await solve("bob", "text-utils"); // 3
    await solve("cyd", "protect-closed-won"); // 3
    expect((await community.countryBoard()).map((c) => [c.rank, c.country, c.learners, c.score, c.top.handle])).toEqual([
      [1, "IN", 2, 9, "ann"],
      [2, "DE", 1, 3, "cyd"],
    ]);
    expect((await community.leaderboard("all", 100, undefined, "DE")).map((r) => r.handle)).toEqual(["cyd"]);
    // An older client that doesn't send country leaves it alone; null clears it.
    const withoutCountry: Partial<typeof EMPTY_ABOUT> = { ...EMPTY_ABOUT };
    delete withoutCountry.country;
    await community.updateAbout("cyd", withoutCountry as Omit<typeof EMPTY_ABOUT, "country">);
    expect((await about.get("cyd"))?.country).toBe("DE");
    await community.updateAbout("cyd", { ...EMPTY_ABOUT, country: null });
    expect((await about.get("cyd"))?.country).toBeNull();
  });

  it("mentors: Ranger and up only; requests become notifications", async () => {
    await expect(hub.setMentor("ann", { topics: ["Apex"], note: "", active: true })).rejects.toMatchObject({ status: 403 });
    // 30+ points: Ranger.
    for (const slug of ["won-revenue-rollup", "close-stale-opportunities", "sync-contact-city", "debug-soql-in-loop", "debug-recursive-trigger", "text-utils"]) await solve("ann", slug);
    expect((await hub.myMentor("ann")).eligible).toBe(true);
    await hub.setMentor("ann", { topics: ["Apex", "Triggers"], note: "Ask me about bulkification", active: true });
    expect((await hub.mentors()).map((m) => [m.handle, m.topics])).toEqual([["ann", ["Apex", "Triggers"]]]);
    await expect(hub.ask("bob", "ann", "hi")).rejects.toMatchObject({ status: 400 });
    await hub.ask("bob", "ann", "How do I avoid SOQL in loops?");
    expect((await social.notifications("ann")).items[0]).toMatchObject({ kind: "mentor", data: { handle: "bob", message: "How do I avoid SOQL in loops?" } });
    await expect(hub.ask("ann", "ann", "talking to myself here")).rejects.toMatchObject({ status: 400 });
  });

  it("jobs: admins post, expired ones disappear; open-to-work learners listed", async () => {
    const job = { title: "Salesforce Developer", company: "Acme", location: "Remote", url: "https://acme.example/jobs/1", tags: ["Apex"], days: 7 };
    await expect(hub.postJob("bob", job)).rejects.toMatchObject({ status: 403 });
    await hub.postJob("owner", job);
    await new PgAboutRepository(db).save("cyd", { ...EMPTY_ABOUT, openToWork: true });
    const j = await hub.jobs();
    expect(j.jobs.map((x) => x.title)).toEqual(["Salesforce Developer"]);
    expect(j.openToWork.map((p) => p.handle)).toEqual(["cyd"]);
    clock.advance(8 * 86_400_000);
    expect((await hub.jobs()).jobs).toEqual([]);
    clock.advance(-8 * 86_400_000);
  });
});
