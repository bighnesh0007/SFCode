/** Community problem drafts end to end on Postgres, with a fake org checker. Skipped without TEST_DATABASE_URL. */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgDatabase, type PgDatabase } from "../../src/data/postgres/client.ts";
import type { ProblemContent } from "../../src/data/postgres/schema.ts";
import type { GradeResult } from "../../src/domain/challenge.ts";
import { PROBLEMS_DIR } from "../../src/container.ts";
import { PgAdminRepository } from "../../src/repositories/admin.repository.ts";
import { PgProblemDraftRepository } from "../../src/repositories/problemDraft.repository.ts";
import { PgProfileRepository } from "../../src/repositories/profile.repository.ts";
import { AdminService } from "../../src/services/admin/admin.service.ts";
import { ChallengeCatalog } from "../../src/services/challenges/catalog.ts";
import { ProblemDraftService, type OrgChecker } from "../../src/services/problems/problemDraft.service.ts";
import { fixedClock } from "../fakes.ts";

const url = process.env.TEST_DATABASE_URL;
const safe = url !== undefined && new URL(url).pathname.endsWith("_test");

const content = (over: Partial<ProblemContent> = {}): ProblemContent => ({
  title: "Double It",
  track: "apex",
  difficulty: "Easy",
  category: "Classes",
  tags: ["static methods"],
  statement: "Write a class SfcDemoDouble with a static method twice(Integer n) that returns n * 2, and null for null.",
  files: [{ name: "SfcDemoDouble", type: "class" }],
  starter: { SfcDemoDouble: "public with sharing class SfcDemoDouble {\n    public static Integer twice(Integer n) { return 0; }\n}" },
  reference: { SfcDemoDouble: "public with sharing class SfcDemoDouble {\n    public static Integer twice(Integer n) { return n == null ? null : n * 2; }\n}" },
  testClass: "SfcDemoDoubleTest",
  testSource: "@isTest\nprivate class SfcDemoDoubleTest {\n    @isTest static void doubles() { System.assertEquals(4, SfcDemoDouble.twice(2)); }\n}",
  ...over,
});

const result = (ok: boolean): GradeResult => ({ verdict: ok ? "accepted" : "wrong_answer", testsRun: 1, testsPassed: ok ? 1 : 0, tests: [], compileErrors: [], coverage: [], message: null });
/** Passes code containing "n * 2" (the real logic); fails anything else, like the starter. */
const checker: OrgChecker = { grade: (_u, _c, sources) => Promise.resolve(result(Object.values(sources).some((s) => s.includes("n * 2")))) };

describe.skipIf(!safe)("problem drafts on Postgres", () => {
  let db: PgDatabase;
  let admin: AdminService;
  let catalog: ChallengeCatalog;
  let svc: ProblemDraftService;
  let repo: PgProblemDraftRepository;

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE problem_drafts, problems, user_roles, user_profiles`);
    const clock = fixedClock();
    admin = new AdminService(new PgAdminRepository(db), "owner", clock);
    catalog = ChallengeCatalog.load(PROBLEMS_DIR);
    repo = new PgProblemDraftRepository(db);
    const profiles = new PgProfileRepository(db);
    for (const [id, h] of [["bud", "buddy-ann"], ["rev", "rev-bob"], ["rev2", "rev-cy"]]) await profiles.create({ userId: id ?? "", handle: h ?? "", displayName: h ?? "", imageUrl: null });
    await admin.grant("owner", "rev", "reviewer");
    await admin.grant("owner", "rev2", "reviewer");
    await admin.grant("rev", "bud", "buddy");
    svc = new ProblemDraftService(repo, catalog, admin, profiles, checker, clock);
  });

  /** The check runs in the background; wait for it to settle. */
  async function settle(id: string) {
    for (let i = 0; i < 50; i++) {
      const d = await repo.find(id);
      if (d?.check && d.check.status !== "running") return d.check;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error("check never finished");
  }

  it("only buddies and up create; others can't read someone's draft", async () => {
    await expect(svc.create("stranger", content())).rejects.toMatchObject({ status: 403 });
    const d = await svc.create("bud", content());
    expect(d).toMatchObject({ canEdit: true, canReview: false });
    await expect(svc.get("stranger", d.id)).rejects.toMatchObject({ status: 403 });
    expect((await svc.get("rev", d.id)).content.testSource).toContain("@isTest"); // reviewers see hidden tests
  });

  it("submitting needs a passing check on the current content", async () => {
    const d = await svc.create("bud", content());
    await expect(svc.submit("bud", d.id)).rejects.toThrow(/Test in my org/);
    await svc.check("bud", d.id);
    expect(await settle(d.id)).toMatchObject({ status: "passed" });
    await svc.update("bud", d.id, content({ statement: `${content().statement} Edited.` }));
    await expect(svc.submit("bud", d.id)).rejects.toThrow(/Test in my org/); // edit invalidates the check
    await svc.check("bud", d.id);
    await settle(d.id);
    expect((await svc.submit("bud", d.id)).status).toBe("submitted");
    await expect(svc.update("bud", d.id, content())).rejects.toMatchObject({ status: 409 }); // locked while in review
  });

  it("a check fails when the starter also passes, or the solution doesn't", async () => {
    const weak = await svc.create("bud", content({ starter: content().reference }));
    await svc.check("bud", weak.id);
    expect(await settle(weak.id)).toMatchObject({ status: "failed", message: expect.stringMatching(/starter code also passes/) });
    const broken = await svc.create("bud", content({ title: "Broken One", reference: content().starter }));
    await svc.check("bud", broken.id);
    expect(await settle(broken.id)).toMatchObject({ status: "failed" });
  });

  it("review: no self-review; approval needs the reviewer's own check; approve publishes into the catalog", async () => {
    const d = await svc.create("bud", content());
    await svc.check("bud", d.id);
    await settle(d.id);
    await svc.submit("bud", d.id);
    expect((await svc.queue("rev")).map((q) => q.author)).toEqual(["buddy-ann"]);
    expect(await svc.get("bud", d.id)).toMatchObject({ canEdit: false, canReview: false });
    expect(await svc.get("rev", d.id)).toMatchObject({ canEdit: false, canReview: true });
    await expect(svc.decide("bud", d.id, "approve", "")).rejects.toMatchObject({ status: 403 });
    await expect(svc.decide("rev", d.id, "approve", "")).rejects.toThrow(/Run the check in your own org/);
    await svc.check("rev", d.id);
    await settle(d.id);
    const told: { userId: string; data: Record<string, string> }[] = [];
    svc.setNotifier((userId, _kind, data) => {
      told.push({ userId, data });
      return Promise.resolve();
    });
    const approved = await svc.decide("rev", d.id, "approve", "Nice one");
    expect(told).toEqual([{ userId: "bud", data: expect.objectContaining({ action: "approved", slug: "double-it" }) }]);
    expect(approved).toMatchObject({ status: "approved", publishedSlug: "double-it" });
    const live = catalog.get("double-it");
    expect(live).toMatchObject({ authorId: "bud", title: "Double It" });
    expect(live?.order).toBeGreaterThanOrEqual(1000);
    expect(await svc.countPublishedBy("bud")).toBe(1);
    await expect(svc.decide("rev2", d.id, "reject", "")).rejects.toMatchObject({ status: 409 });

    // A fresh server loads it back from the database.
    const fresh = ChallengeCatalog.load(PROBLEMS_DIR);
    const svc2 = new ProblemDraftService(repo, fresh, admin, new PgProfileRepository(db), checker, fixedClock());
    expect(await svc2.loadPublished()).toBe(1);
    expect(fresh.get("double-it")?.testClass.name).toBe("SfcDemoDoubleTest");
  });

  it("changes requested → edit → re-check → resubmit; reject is final", async () => {
    const d = await svc.create("bud", content());
    await svc.check("bud", d.id);
    await settle(d.id);
    await svc.submit("bud", d.id);
    await expect(svc.decide("rev", d.id, "changes", "")).rejects.toThrow(/what to change/);
    expect((await svc.decide("rev", d.id, "changes", "Add a null test.")).status).toBe("changes_requested");
    await svc.update("bud", d.id, content({ testSource: content().testSource.replace("}\n}", "}\n    @isTest static void nulls() { System.assertEquals(null, SfcDemoDouble.twice(null)); }\n}") }));
    await svc.check("bud", d.id);
    await settle(d.id);
    expect((await svc.submit("bud", d.id)).status).toBe("submitted");
    expect((await svc.decide("rev", d.id, "reject", "Duplicate of an existing problem.")).status).toBe("rejected");
    await expect(svc.submit("bud", d.id)).rejects.toMatchObject({ status: 409 });
  });

  it("drafts clashing with built-in Apex names are reported; admins unpublish and restore", async () => {
    const clash = await svc.create("bud", content({ title: "Clash", files: [{ name: "SfcTextUtils", type: "class" }], starter: { SfcTextUtils: "public class SfcTextUtils {}" }, reference: { SfcTextUtils: "public class SfcTextUtils { Integer n * 2; }" } }));
    expect(clash.problems.join(" ")).toMatch(/SfcTextUtils is also used by text-utils/);

    const d = await svc.create("bud", content());
    await svc.check("bud", d.id);
    await settle(d.id);
    await svc.submit("bud", d.id);
    await svc.check("rev", d.id);
    await settle(d.id);
    await svc.decide("rev", d.id, "approve", "");
    await expect(svc.setActive("rev", "double-it", false)).rejects.toMatchObject({ status: 403 });
    await svc.setActive("owner", "double-it", false);
    expect(catalog.get("double-it")).toBeUndefined();
    await svc.setActive("owner", "double-it", true);
    expect(catalog.get("double-it")).toBeDefined();
  });

  it("a check that finishes after an edit doesn't count for the edited version", async () => {
    const opened: { release?: (value: boolean) => void } = {};
    const gate = new Promise<boolean>((r) => (opened.release = r));
    const release = () => opened.release?.(true);
    const slow: OrgChecker = { grade: async (u, c, src) => { await gate; return checker.grade(u, c, src); } };
    const profiles = new PgProfileRepository(db);
    const slowSvc = new ProblemDraftService(repo, catalog, admin, profiles, slow, fixedClock());
    const d = await slowSvc.create("bud", content());
    await slowSvc.check("bud", d.id); // running on the original content
    await slowSvc.update("bud", d.id, content({ statement: `${content().statement} Changed while checking.` }));
    release();
    expect(await settle(d.id)).toMatchObject({ status: "passed" }); // the stale run lands…
    await expect(slowSvc.submit("bud", d.id)).rejects.toThrow(/Test in my org/); // …but doesn't count
    expect((await slowSvc.get("bud", d.id)).check?.current).toBe(false);
  });
});
