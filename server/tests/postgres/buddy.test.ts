/** Buddy applications against a real database. Skipped without TEST_DATABASE_URL. */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgDatabase, type PgDatabase } from "../../src/data/postgres/client.ts";
import { PROBLEMS_DIR } from "../../src/container.ts";
import { PgAdminRepository } from "../../src/repositories/admin.repository.ts";
import { PgBuddyRepository } from "../../src/repositories/buddy.repository.ts";
import { PgChallengeSubmissionRepository } from "../../src/repositories/challengeSubmission.repository.ts";
import { PgProfileRepository } from "../../src/repositories/profile.repository.ts";
import { AdminService } from "../../src/services/admin/admin.service.ts";
import { BuddyService } from "../../src/services/buddy/buddy.service.ts";
import { ChallengeCatalog } from "../../src/services/challenges/catalog.ts";
import { CommunityService } from "../../src/services/community/community.service.ts";
import { fixedClock } from "../fakes.ts";

const url = process.env.TEST_DATABASE_URL;
const safe = url !== undefined && new URL(url).pathname.endsWith("_test");
const why = "I teach Apex at my company and want to write practice problems.";

describe.skipIf(!safe)("Buddy applications on Postgres", () => {
  let db: PgDatabase;
  let buddies: BuddyService;
  let admin: AdminService;

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE buddy_applications, user_roles, user_profiles`);
    const clock = fixedClock();
    const profiles = new PgProfileRepository(db);
    const identity = { lookup: (id: string) => Promise.resolve({ username: id, displayName: id, imageUrl: null }) };
    const community = new CommunityService(ChallengeCatalog.load(PROBLEMS_DIR), new PgChallengeSubmissionRepository(db), profiles, identity, clock);
    admin = new AdminService(new PgAdminRepository(db), "owner", clock);
    buddies = new BuddyService(new PgBuddyRepository(db), admin, community, profiles);
    await community.ensureProfile("rev");
    await admin.grant("owner", "rev", "reviewer");
  });

  it("apply once; a second pending application is refused; short ones too", async () => {
    await expect(buddies.apply("ann", "too short", "")).rejects.toMatchObject({ status: 400 });
    const me = await buddies.apply("ann", why, "https://github.com/ann");
    expect(me).toMatchObject({ standing: null, application: { status: "pending" } });
    await expect(buddies.apply("ann", why, "")).rejects.toMatchObject({ status: 409 });
  });

  it("a reviewer approves: the applicant becomes a buddy; deciding twice is refused", async () => {
    await buddies.apply("ann", why, "");
    const [app] = await buddies.pending("rev");
    expect(app).toMatchObject({ handle: "ann", motivation: why });
    const told: { userId: string; data: Record<string, string> }[] = [];
    buddies.setNotifier((userId, _kind, data) => {
      told.push({ userId, data });
      return Promise.resolve();
    });
    await buddies.decide("rev", app?.id ?? "", true, "Welcome!");
    expect(told).toEqual([{ userId: "ann", data: { approved: "yes", note: "Welcome!" } }]);
    expect(await admin.standing("ann")).toBe("buddy");
    expect((await buddies.me("ann")).application).toMatchObject({ status: "approved", note: "Welcome!" });
    await expect(buddies.decide("rev", app?.id ?? "", false, "")).rejects.toMatchObject({ status: 409 });
    await expect(buddies.apply("ann", why, "")).rejects.toMatchObject({ status: 400 }); // already has a role
  });

  it("rejected applicants can apply again; non-reviewers can't see or decide", async () => {
    await buddies.apply("bob", why, "");
    await expect(buddies.pending("bob")).rejects.toMatchObject({ status: 403 });
    const [app] = await buddies.pending("rev");
    await expect(buddies.decide("bob", app?.id ?? "", true, "")).rejects.toMatchObject({ status: 403 });
    await buddies.decide("rev", app?.id ?? "", false, "Write a bit more about your Salesforce experience.");
    expect(await admin.standing("bob")).toBeNull();
    await buddies.apply("bob", why, "");
    expect((await buddies.me("bob")).application?.status).toBe("pending");
  });
});
