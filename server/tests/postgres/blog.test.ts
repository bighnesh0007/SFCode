/**
 * The blog against a real database: the permission rules, and the vote /
 * comment counts (correlated subqueries a fake couldn't check). Skipped
 * without TEST_DATABASE_URL; in CI that's an error (see repository.test.ts).
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgDatabase, type PgDatabase } from "../../src/data/postgres/client.ts";
import { PROBLEMS_DIR } from "../../src/container.ts";
import { PgAdminRepository } from "../../src/repositories/admin.repository.ts";
import { PgBlogRepository } from "../../src/repositories/blog.repository.ts";
import { PgChallengeSubmissionRepository } from "../../src/repositories/challengeSubmission.repository.ts";
import { PgProfileRepository } from "../../src/repositories/profile.repository.ts";
import { AdminService } from "../../src/services/admin/admin.service.ts";
import { BlogService } from "../../src/services/blog/blog.service.ts";
import { ChallengeCatalog } from "../../src/services/challenges/catalog.ts";
import { CommunityService } from "../../src/services/community/community.service.ts";
import { fixedClock } from "../fakes.ts";

const url = process.env.TEST_DATABASE_URL;
const safe = url !== undefined && new URL(url).pathname.endsWith("_test");

describe.skipIf(!safe)("BlogService on Postgres", () => {
  let db: PgDatabase;
  let blog: BlogService;
  let admin: AdminService;
  const body = "This is a post body that is long enough to pass validation.";

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
    const clock = fixedClock();
    const profiles = new PgProfileRepository(db);
    const identity = { lookup: (id: string) => Promise.resolve({ username: id, displayName: id, imageUrl: null }) };
    const community = new CommunityService(ChallengeCatalog.load(PROBLEMS_DIR), new PgChallengeSubmissionRepository(db), profiles, identity, clock);
    admin = new AdminService(new PgAdminRepository(db), "owner", clock);
    blog = new BlogService(new PgBlogRepository(db), profiles, community, admin);
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE blog_posts, blog_votes, blog_comments, user_profiles, user_roles CASCADE`);
  });

  it("scores and comment counts are per post, with several posts", async () => {
    const a = await blog.create("alice", { title: "First post here", body });
    const b = await blog.create("alice", { title: "Second post here", body });
    await blog.vote("bob", a.slug, 1);
    await blog.vote("carol", a.slug, 1);
    await blog.vote("bob", b.slug, -1);
    await blog.comment("bob", a.slug, "Nice one");
    const list = await blog.list("top");
    expect(list.map((p) => [p.title, p.score, p.commentCount])).toEqual([
      ["First post here", 2, 1],
      ["Second post here", -1, 0],
    ]);
  });

  it("votes: change, retract, and never on your own post", async () => {
    const p = await blog.create("alice", { title: "Vote on me", body });
    expect(await blog.vote("bob", p.slug, 1)).toEqual({ score: 1, myVote: 1 });
    expect(await blog.vote("bob", p.slug, -1)).toEqual({ score: -1, myVote: -1 });
    expect(await blog.vote("bob", p.slug, 0)).toEqual({ score: 0, myVote: 0 });
    await expect(blog.vote("alice", p.slug, 1)).rejects.toThrow(/own post/);
  });

  it("only the author edits; others can't delete; author delete is real", async () => {
    const p = await blog.create("alice", { title: "Mine to edit", body });
    await expect(blog.update("bob", p.slug, { title: "Hijacked title" })).rejects.toMatchObject({ status: 403 });
    expect((await blog.update("alice", p.slug, { title: "Edited title" })).title).toBe("Edited title");
    await expect(blog.remove("bob", p.slug)).rejects.toMatchObject({ status: 403 });
    await blog.remove("alice", p.slug);
    await expect(blog.get(p.slug, null)).rejects.toMatchObject({ status: 404 });
  });

  it("buddies and up hide posts and comments: gone for everyone else, visible to them", async () => {
    await blog.create("mod", { title: "Seed for the mod profile", body });
    await admin.grant("owner", "mod", "buddy");
    const p = await blog.create("alice", { title: "Spammy post", body });
    const withComment = await blog.comment("bob", p.slug, "spam comment");
    const commentId = withComment.comments[0]?.id ?? "";

    await blog.removeComment("mod", commentId);
    expect((await blog.get(p.slug, "alice")).comments).toHaveLength(0);
    expect((await blog.get(p.slug, "mod")).comments[0]?.hidden).toBe(true);

    await blog.remove("mod", p.slug);
    await expect(blog.get(p.slug, "alice")).rejects.toMatchObject({ status: 404 });
    expect((await blog.get(p.slug, "mod")).status).toBe("hidden");
    expect((await blog.list("new")).map((x) => x.slug)).not.toContain(p.slug);
    await expect(blog.setHidden("bob", p.slug, false)).rejects.toMatchObject({ status: 403 });
    await blog.setHidden("mod", p.slug, false);
    expect((await blog.get(p.slug, "alice")).status).toBe("published");
  });

  it("validates lengths and stores hostile Markdown as plain text for the sanitizer", async () => {
    await expect(blog.create("alice", { title: "Hi", body })).rejects.toThrow(/title must be 5–120/);
    const evil = '<img src=x onerror="alert(1)"> **bold** and enough text to pass.';
    const p = await blog.create("alice", { title: "Hostile body", body: evil });
    expect(p.body).toBe(evil);
    expect(p.excerpt).not.toContain("**");
    expect(p.excerpt).not.toMatch(/<|onerror/);
  });
});
