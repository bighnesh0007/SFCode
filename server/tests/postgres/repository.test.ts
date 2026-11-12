/**
 * Runs the real Postgres repository against a throwaway database. Skipped unless
 * TEST_DATABASE_URL is set, and it refuses any database whose name does not end
 * in `_test`, because it truncates both tables.
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgDatabase, type PgDatabase } from "../../src/data/postgres/client.ts";
import { PgSalesforceConnectionRepository } from "../../src/repositories/salesforceConnection.repository.ts";
import { PgChallengeSubmissionRepository } from "../../src/repositories/challengeSubmission.repository.ts";
import { PgCertAttemptRepository } from "../../src/repositories/certAttempt.repository.ts";
import type { GradeResult } from "../../src/domain/challenge.ts";

const url = process.env.TEST_DATABASE_URL;
const safe = url !== undefined && new URL(url).pathname.endsWith("_test");

describe.skipIf(!safe)("PgSalesforceConnectionRepository", () => {
  let db: PgDatabase;
  let repo: PgSalesforceConnectionRepository;

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
    repo = new PgSalesforceConnectionRepository(db);
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE salesforce_connections, oauth_pending, challenge_submissions`);
  });

  const pending = (nonce: string, expiresAt: Date) => ({ nonce, userId: "u1", loginUrl: "https://login.salesforce.com", codeVerifierEnc: "enc:v1:x", expiresAt });

  it("consumes a pending handshake exactly once, even under a race", async () => {
    await repo.savePending(pending("n1", new Date(Date.now() + 60_000)));
    const results = await Promise.all([1, 2, 3].map(() => repo.consumePending("n1", "u1", new Date())));
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("will not hand a handshake to another user or after expiry", async () => {
    await repo.savePending(pending("n2", new Date(Date.now() + 60_000)));
    expect(await repo.consumePending("n2", "someone-else", new Date())).toBeNull();
    await repo.savePending(pending("n3", new Date(Date.now() - 1)));
    expect(await repo.consumePending("n3", "u1", new Date())).toBeNull();
  });

  it("upsert replaces the user's connection", async () => {
    const base = { userId: "u1", orgId: "00D1", sfUserId: "005", username: "a@b.c", instanceUrl: "https://a.my.salesforce.com", loginUrl: "https://login.salesforce.com", accessTokenEnc: "enc:v1:a", refreshTokenEnc: "enc:v1:r" };
    await repo.upsert(base);
    await repo.upsert({ ...base, orgId: "00D2" });
    expect((await repo.findByUser("u1"))?.orgId).toBe("00D2");
    await repo.updateTokens("u1", { accessTokenEnc: "enc:v1:new", instanceUrl: "https://b.my.salesforce.com" });
    expect(await repo.findByUser("u1")).toMatchObject({ accessTokenEnc: "enc:v1:new", instanceUrl: "https://b.my.salesforce.com", refreshTokenEnc: "enc:v1:r" });
    await repo.updateTokens("u1", { accessTokenEnc: "enc:v1:new2", instanceUrl: "https://b.my.salesforce.com", refreshTokenEnc: "enc:v1:r2" });
    expect((await repo.findByUser("u1"))?.refreshTokenEnc).toBe("enc:v1:r2");
    expect(await repo.delete("u1")).toBe(true);
    expect(await repo.delete("u1")).toBe(false);
  });
});

describe.skipIf(!safe)("PgChallengeSubmissionRepository", () => {
  let db: PgDatabase;
  let repo: PgChallengeSubmissionRepository;
  const result = (verdict: GradeResult["verdict"]): GradeResult => ({ verdict, testsRun: 1, testsPassed: verdict === "accepted" ? 1 : 0, tests: [], compileErrors: [], coverage: [], message: null });
  const input = (userId = "u1", problemSlug = "p1") => ({ userId, problemSlug, orgId: "00D", files: { SfcA: "class SfcA {}" } });

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
    repo = new PgChallengeSubmissionRepository(db);
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE challenge_submissions`);
  });

  it("the database allows one running submission per user, even under a race", async () => {
    const results = await Promise.all([1, 2, 3, 4].map(() => repo.createRunning(input())));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await repo.createRunning(input("u2"))).not.toBeNull();
  });

  it("completes a submission once; a second completion cannot overwrite it", async () => {
    const r = await repo.createRunning(input());
    if (!r) throw new Error("setup");
    expect(await repo.complete(r.id, "accepted", result("accepted"), new Date())).toBe(true);
    expect(await repo.complete(r.id, "error", result("error"), new Date())).toBe(false);
    expect((await repo.findById(r.id))?.status).toBe("accepted");
    expect(await repo.createRunning(input())).not.toBeNull();
  });

  it("round-trips files and result JSON", async () => {
    const r = await repo.createRunning(input());
    if (!r) throw new Error("setup");
    await repo.setDeployId(r.id, "0Af1");
    await repo.complete(r.id, "wrong_answer", result("wrong_answer"), new Date());
    expect(await repo.findById(r.id)).toMatchObject({ deployId: "0Af1", files: { SfcA: "class SfcA {}" }, result: { verdict: "wrong_answer" } });
  });

  it("reports progress per problem", async () => {
    for (const [slug, status] of [["p1", "wrong_answer"], ["p1", "accepted"], ["p2", "compile_error"]] as const) {
      const r = await repo.createRunning(input("u1", slug));
      if (!r) throw new Error("setup");
      await repo.complete(r.id, status, result(status), new Date());
    }
    expect(Object.fromEntries(await repo.progress("u1"))).toEqual({ p1: "solved", p2: "attempted" });
    expect((await repo.listForProblem("u1", "p1", 10)).map((r) => r.status)).toEqual(["accepted", "wrong_answer"]);
  });
});

describe.skipIf(!safe)("PgCertAttemptRepository", () => {
  let db: PgDatabase;
  let repo: PgCertAttemptRepository;

  beforeAll(async () => {
    db = createPgDatabase(url ?? "");
    await migrate(db, { migrationsFolder: new URL("../../src/data/postgres/migrations", import.meta.url).pathname });
    repo = new PgCertAttemptRepository(db);
  });
  afterAll(() => db.close());
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE cert_attempts`);
  });

  it("latest() keeps only the most recent outcome per question, per user and exam", async () => {
    await repo.record({ userId: "u1", exam: "pd1", questionId: "q1", correct: false });
    await new Promise((r) => setTimeout(r, 5));
    await repo.record({ userId: "u1", exam: "pd1", questionId: "q1", correct: true });
    await repo.record({ userId: "u1", exam: "pd1", questionId: "q2", correct: false });
    await repo.record({ userId: "u2", exam: "pd1", questionId: "q3", correct: true });
    await repo.record({ userId: "u1", exam: "pd2", questionId: "q4", correct: true });
    expect(Object.fromEntries(await repo.latest("u1", "pd1"))).toEqual({ q1: true, q2: false });
  });
});
