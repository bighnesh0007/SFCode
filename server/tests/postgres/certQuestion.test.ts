/** Buddy-written certification questions against a real database. Skipped without TEST_DATABASE_URL. */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgDatabase, type PgDatabase } from "../../src/data/postgres/client.ts";
import { CERTIFICATION_DIR, PROBLEMS_DIR } from "../../src/container.ts";
import { PgAdminRepository } from "../../src/repositories/admin.repository.ts";
import { PgCertQuestionRepository } from "../../src/repositories/certQuestion.repository.ts";
import { PgChallengeSubmissionRepository } from "../../src/repositories/challengeSubmission.repository.ts";
import { PgProfileRepository } from "../../src/repositories/profile.repository.ts";
import { AdminService } from "../../src/services/admin/admin.service.ts";
import { QuestionBank } from "../../src/services/certification/bank.ts";
import { bankId, CertQuestionService } from "../../src/services/certification/certQuestion.service.ts";
import { CertificationService } from "../../src/services/certification/certification.service.ts";
import { ChallengeCatalog } from "../../src/services/challenges/catalog.ts";
import { CommunityService } from "../../src/services/community/community.service.ts";
import { fixedClock } from "../fakes.ts";

const url = process.env.TEST_DATABASE_URL;
const safe = url !== undefined && new URL(url).pathname.endsWith("_test");

const question = {
  exam: "pd1",
  section: "fundamentals",
  prompt: "Which keyword makes an Apex class respect the running user's sharing rules?",
  options: [
    { id: "a", text: "with sharing" },
    { id: "b", text: "without sharing" },
    { id: "c", text: "inherited sharing only in triggers" },
    { id: "d", text: "global" },
  ],
  answer: ["a"],
  explanation: "with sharing enforces the running user's record access; without sharing ignores it.",
};

describe.skipIf(!safe)("Certification questions from Buddies, on Postgres", () => {
  let db: PgDatabase;
  let bank: QuestionBank;
  let service: CertQuestionService;
  let cert: CertificationService;
  let admin: AdminService;
  const told: Record<string, string>[] = [];

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE cert_question_drafts, user_roles, user_profiles`);
    const clock = fixedClock();
    const profiles = new PgProfileRepository(db);
    const identity = { lookup: (id: string) => Promise.resolve({ username: id, displayName: id, imageUrl: null }) };
    const community = new CommunityService(ChallengeCatalog.load(PROBLEMS_DIR), new PgChallengeSubmissionRepository(db), profiles, identity, clock);
    admin = new AdminService(new PgAdminRepository(db), "owner", clock);
    bank = QuestionBank.load(CERTIFICATION_DIR);
    cert = new CertificationService(bank, undefined);
    service = new CertQuestionService(new PgCertQuestionRepository(db), bank, admin, profiles);
    told.length = 0;
    service.setNotifier((_u, _k, data) => {
      told.push(data);
      return Promise.resolve();
    });
    for (const u of ["ann", "rev"]) await community.ensureProfile(u);
    await admin.grant("owner", "ann", "buddy");
    await admin.grant("owner", "rev", "reviewer");
  });

  it("only Buddies submit; the bank's rules apply", async () => {
    await expect(service.submit("stranger", question)).rejects.toMatchObject({ status: 403 });
    await expect(service.submit("ann", { ...question, exam: "nope" })).rejects.toThrow(/Pick an exam/);
    await expect(service.submit("ann", { ...question, section: "nope" })).rejects.toThrow(/unknown section/);
    await expect(service.submit("ann", { ...question, answer: ["a", "b"] })).rejects.toThrow(/Choose 2/);
    await expect(service.submit("ann", { ...question, answer: ["z"] })).rejects.toThrow(/answer/);
    const q = await service.submit("ann", question);
    expect(q).toMatchObject({ status: "submitted", examTitle: "Platform Developer I" });
    expect((await service.mine("ann")).map((r) => r.id)).toEqual([q.id]);
  });

  it("reviewers approve into practice, never into mocks; authors can't review themselves", async () => {
    const q = await service.submit("ann", question);
    await admin.grant("owner", "ann", "reviewer");
    await expect(service.decide("ann", q.id, "approve", "")).rejects.toMatchObject({ status: 403 });
    expect((await service.queue("rev")).map((r) => r.author)).toEqual(["ann"]);
    await service.decide("rev", q.id, "approve", "");
    expect(told.at(-1)).toMatchObject({ cert: "yes", action: "approved" });

    const id = bankId(q.id);
    expect(bank.question(id)?.question.prompt).toBe(question.prompt);
    const all = bank.exam("pd1")?.sections.flatMap((s) => cert.practice("pd1", s.id, 100)) ?? [];
    expect(all.find((p) => p.id === id)).toMatchObject({ community: true });
    for (let i = 0; i < 20; i++) expect(cert.mock("pd1").questions.some((p) => p.id === id)).toBe(false);
    await expect(service.decide("rev", q.id, "reject", "")).rejects.toMatchObject({ status: 409 });
  });

  it("changes requested → edit → resubmitted; reject is final", async () => {
    const q = await service.submit("ann", question);
    await expect(service.decide("rev", q.id, "changes", "  ")).rejects.toThrow(/what to change/);
    await service.decide("rev", q.id, "changes", "Say why 'global' is wrong too.");
    expect((await service.mine("ann"))[0]).toMatchObject({ status: "changes_requested", reviewNote: "Say why 'global' is wrong too." });
    await expect(service.edit("rev", q.id, question)).rejects.toMatchObject({ status: 404 });
    await service.edit("ann", q.id, { ...question, explanation: question.explanation + " global is about visibility." });
    expect((await service.queue("rev")).map((r) => r.id)).toEqual([q.id]);
    await service.decide("rev", q.id, "reject", "Duplicate of pd1-sharing-inherit.");
    await expect(service.edit("ann", q.id, question)).rejects.toMatchObject({ status: 409 });
    expect(bank.question(bankId(q.id))).toBeUndefined();
  });

  it("approved questions load at startup; admins can take one out", async () => {
    const q = await service.submit("ann", question);
    await service.decide("rev", q.id, "approve", "");
    const fresh = QuestionBank.load(CERTIFICATION_DIR);
    const restarted = new CertQuestionService(new PgCertQuestionRepository(db), fresh, admin, new PgProfileRepository(db));
    expect(await restarted.loadApproved()).toBe(1);
    expect(fresh.isCommunity(bankId(q.id))).toBe(true);

    await expect(restarted.setActive("rev", q.id, false)).rejects.toMatchObject({ status: 403 });
    await restarted.setActive("owner", q.id, false);
    expect(fresh.question(bankId(q.id))).toBeUndefined();
    const again = QuestionBank.load(CERTIFICATION_DIR);
    expect(await new CertQuestionService(new PgCertQuestionRepository(db), again, admin, new PgProfileRepository(db)).loadApproved()).toBe(0);
  });
});
