/** Admin dashboard, user detail and audit log on Postgres. Skipped without TEST_DATABASE_URL. */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgDatabase, type PgDatabase } from "../../src/data/postgres/client.ts";
import { challengeSubmissions, salesforceConnections, userProfiles, userRoles } from "../../src/data/postgres/schema.ts";
import { PgAdminRepository } from "../../src/repositories/admin.repository.ts";

const url = process.env.TEST_DATABASE_URL;
const safe = url !== undefined && new URL(url).pathname.endsWith("_test");

describe.skipIf(!safe)("admin repository on Postgres", () => {
  let db: PgDatabase;
  let repo: PgAdminRepository;
  const day = (d: number, h = 12) => new Date(Date.UTC(2026, 10, d, h));

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
    repo = new PgAdminRepository(db);
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE user_profiles, user_roles, challenge_submissions, cert_attempts, salesforce_connections, admin_audit CASCADE`);
    await db.insert(userProfiles).values([
      { userId: "u1", handle: "ada", displayName: "Ada", createdAt: day(10) },
      { userId: "u2", handle: "bob", displayName: "Bob", createdAt: day(12) },
      { userId: "u3", handle: "cy", displayName: "Cy", createdAt: day(12, 23) },
    ]);
    const sub = (userId: string, problemSlug: string, status: "accepted" | "wrong_answer" | "running", createdAt: Date) => ({ userId, problemSlug, status, createdAt, orgId: "00D", files: {} });
    await db.insert(challengeSubmissions).values([
      sub("u1", "p1", "wrong_answer", day(12, 1)),
      sub("u1", "p1", "accepted", day(12, 2)),
      sub("u2", "p1", "accepted", day(12, 3)),
      sub("u2", "p2", "wrong_answer", day(13, 1)),
      sub("u1", "p2", "running", day(13, 2)),
    ]);
  });

  it("dashboard: one row per UTC day including empty ones, with sign-ups, submissions, accepted and distinct active users", async () => {
    const d = await repo.dashboard(day(11, 0));
    const byDay = Object.fromEntries(d.days.map((p) => [p.day, p]));
    expect(byDay["2026-11-11"]).toEqual({ day: "2026-11-11", signups: 0, submissions: 0, accepted: 0, active: 0 });
    expect(byDay["2026-11-12"]).toEqual({ day: "2026-11-12", signups: 2, submissions: 3, accepted: 2, active: 2 });
    expect(byDay["2026-11-13"]).toMatchObject({ submissions: 2, accepted: 0, active: 2 });
    expect(byDay["2026-11-10"]).toBeUndefined(); // before the window
    // Per problem, running submissions aren't graded yet so don't count.
    expect(d.problems.sort((a, b) => a.slug.localeCompare(b.slug))).toEqual([
      { slug: "p1", submissions: 3, accepted: 2, solvers: 2 },
      { slug: "p2", submissions: 1, accepted: 0, solvers: 0 },
    ]);
  });

  it("user detail: counts, latest activity, org, roles and recent submissions newest first", async () => {
    await db.insert(userRoles).values({ userId: "u1", role: "moderator", grantedBy: "owner" });
    await db.insert(salesforceConnections).values({ userId: "u1", orgId: "00D", sfUserId: "005", username: "ada@org", instanceUrl: "https://x.my.salesforce.com", loginUrl: "https://login.salesforce.com", accessTokenEnc: "enc:v1:a", refreshTokenEnc: "enc:v1:b" });
    const u = await repo.userDetail("u1");
    expect(u).toMatchObject({ handle: "ada", submissions: 3, accepted: 1, solved: 1, certAnswers: 0, roles: ["reviewer"], org: { username: "ada@org" } });
    expect(u?.lastActive?.toISOString()).toBe(day(13, 2).toISOString());
    expect(u?.recent.map((r) => r.status)).toEqual(["running", "accepted", "wrong_answer"]);
    expect(await repo.userDetail("nobody")).toBeNull();
    expect(await repo.userDetail("u3")).toMatchObject({ submissions: 0, lastActive: null, org: null });
  });

  it("audit log: newest first", async () => {
    await repo.audit({ actorId: "owner", action: "role.grant", targetId: "u1", detail: { role: "admin" } });
    await repo.audit({ actorId: "u1", action: "announcement.clear" });
    const log = await repo.auditLog(10);
    expect(log.map((r) => [r.action, r.targetId, r.detail])).toEqual([
      ["announcement.clear", null, {}],
      ["role.grant", "u1", { role: "admin" }],
    ]);
  });
});
