/** Problem discussions against a real database. Skipped without TEST_DATABASE_URL. */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgDatabase, type PgDatabase } from "../../src/data/postgres/client.ts";
import { PROBLEMS_DIR } from "../../src/container.ts";
import { PgAdminRepository } from "../../src/repositories/admin.repository.ts";
import { PgChallengeSubmissionRepository } from "../../src/repositories/challengeSubmission.repository.ts";
import { PgDiscussionRepository } from "../../src/repositories/discussion.repository.ts";
import { PgProfileRepository } from "../../src/repositories/profile.repository.ts";
import { AdminService } from "../../src/services/admin/admin.service.ts";
import { ChallengeCatalog } from "../../src/services/challenges/catalog.ts";
import { CommunityService } from "../../src/services/community/community.service.ts";
import { DiscussionService, MAX_COMMENTS_PER_DAY } from "../../src/services/discussion/discussion.service.ts";
import { fixedClock } from "../fakes.ts";

const url = process.env.TEST_DATABASE_URL;
const safe = url !== undefined && new URL(url).pathname.endsWith("_test");
const P = "text-utils";

describe.skipIf(!safe)("problem discussions on Postgres", () => {
  let db: PgDatabase;
  let d: DiscussionService;
  let admin: AdminService;

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
    const clock = fixedClock();
    const profiles = new PgProfileRepository(db);
    const catalog = ChallengeCatalog.load(PROBLEMS_DIR);
    const identity = { lookup: (id: string) => Promise.resolve({ username: id, displayName: id.toUpperCase(), imageUrl: null }) };
    const community = new CommunityService(catalog, new PgChallengeSubmissionRepository(db), profiles, identity, clock);
    admin = new AdminService(new PgAdminRepository(db), "owner", clock);
    d = new DiscussionService(new PgDiscussionRepository(db), catalog, profiles, community, admin, clock);
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE problem_comments, user_profiles, user_roles CASCADE`);
  });

  it("posts appear oldest first with their author; spoiler flag kept; unknown problems 404", async () => {
    await d.post("ada", P, "  Use split(' ', -1) to keep the spaces.  ", true);
    const after = await d.post("bob", P, "Thanks, that worked!", false);
    expect(after.map((c) => [c.author.handle, c.body, c.spoiler])).toEqual([
      ["ada", "Use split(' ', -1) to keep the spaces.", true],
      ["bob", "Thanks, that worked!", false],
    ]);
    expect(await d.list(P, null)).toHaveLength(2);
    expect(await d.list("soql-hot-tech-accounts", null)).toEqual([]);
    await expect(d.list("no-such-problem", null)).rejects.toMatchObject({ status: 404 });
    await expect(d.post("ada", "no-such-problem", "hello there", false)).rejects.toMatchObject({ status: 404 });
  });

  it("validates length and caps posts per day", async () => {
    await expect(d.post("ada", P, " x ", false)).rejects.toThrow(/2–4000/);
    await expect(d.post("ada", P, "y".repeat(4001), false)).rejects.toThrow(/2–4000/);
    for (let i = 0; i < MAX_COMMENTS_PER_DAY; i++) await d.post("ada", P, `comment ${i}`, false);
    await expect(d.post("ada", P, "one more", false)).rejects.toThrow(/a day/);
    await d.post("bob", P, "others can still post", false);
  });

  it("authors delete their own; moderators hide and restore; hidden only reaches moderators", async () => {
    await db.execute(sql`INSERT INTO user_profiles (user_id, handle, display_name) VALUES ('mod', 'mod', 'Mod')`);
    await admin.grant("owner", "mod", "buddy");
    const [mine] = await d.post("ada", P, "my comment", false);
    const [, theirs] = await d.post("bob", P, "spam spam spam", false);
    if (!mine || !theirs) throw new Error("posts missing");
    expect((await d.list(P, "bob"))[0]?.canDelete).toBe(false); // ada's comment, as bob sees it
    expect((await d.list(P, "ada"))[0]?.canDelete).toBe(true);
    await expect(d.remove("bob", mine.id)).rejects.toMatchObject({ status: 403 });

    await expect(d.setHidden("ada", theirs.id, true)).rejects.toMatchObject({ status: 403 });
    await d.setHidden("mod", theirs.id, true);
    expect((await d.list(P, "ada")).map((c) => c.body)).toEqual(["my comment"]);
    const modView = await d.list(P, "mod");
    expect(modView.find((c) => c.id === theirs.id)).toMatchObject({ hidden: true, canHide: true });
    expect((await d.recent("mod")).find((c) => c.id === theirs.id)).toMatchObject({ hidden: true, problem: { slug: P, title: "Text Utilities" } });
    expect((await d.counts([P])).get(P)).toBe(1);

    await d.setHidden("mod", theirs.id, false);
    await d.remove("ada", mine.id);
    expect((await d.list(P, null)).map((c) => c.body)).toEqual(["spam spam spam"]);
  });
});
