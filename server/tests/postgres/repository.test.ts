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
    await db.execute(sql`TRUNCATE salesforce_connections, oauth_pending`);
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
    await repo.updateAccessToken("u1", "enc:v1:new", "https://b.my.salesforce.com");
    expect(await repo.findByUser("u1")).toMatchObject({ accessTokenEnc: "enc:v1:new", instanceUrl: "https://b.my.salesforce.com" });
    expect(await repo.delete("u1")).toBe(true);
    expect(await repo.delete("u1")).toBe(false);
  });
});
