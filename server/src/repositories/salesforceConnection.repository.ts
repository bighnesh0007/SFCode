/**
 * Persistence for org connections and pending OAuth handshakes. Values crossing
 * this boundary are already encrypted — the repository never sees a raw token.
 */
import { and, eq, gt, lt } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { oauthPending, salesforceConnections } from "../data/postgres/schema.ts";

export interface StoredConnection {
  userId: string;
  orgId: string;
  sfUserId: string;
  username: string;
  instanceUrl: string;
  loginUrl: string;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  connectedAt: Date;
}

export interface PendingHandshake {
  nonce: string;
  userId: string;
  loginUrl: string;
  codeVerifierEnc: string;
  expiresAt: Date;
}

export interface SalesforceConnectionRepository {
  findByUser(userId: string): Promise<StoredConnection | null>;
  upsert(conn: Omit<StoredConnection, "connectedAt">): Promise<void>;
  /**
   * Store the result of a token refresh. `refreshTokenEnc` is set when the
   * org rotates refresh tokens: the old one stops working once a new one is
   * issued, so it must be replaced in the same write.
   */
  updateTokens(userId: string, tokens: { accessTokenEnc: string; instanceUrl: string; refreshTokenEnc?: string }): Promise<void>;
  delete(userId: string): Promise<boolean>;
  savePending(p: PendingHandshake): Promise<void>;
  /** Atomically delete and return an unexpired handshake; null if absent, expired or already used. */
  consumePending(nonce: string, userId: string, now: Date): Promise<PendingHandshake | null>;
}

export class PgSalesforceConnectionRepository implements SalesforceConnectionRepository {
  constructor(private readonly db: PgDatabase) {}

  async findByUser(userId: string): Promise<StoredConnection | null> {
    const rows = await this.db.select().from(salesforceConnections).where(eq(salesforceConnections.userId, userId)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.userId,
      orgId: row.orgId,
      sfUserId: row.sfUserId,
      username: row.username,
      instanceUrl: row.instanceUrl,
      loginUrl: row.loginUrl,
      accessTokenEnc: row.accessTokenEnc,
      refreshTokenEnc: row.refreshTokenEnc,
      connectedAt: row.connectedAt,
    };
  }

  async upsert(conn: Omit<StoredConnection, "connectedAt">): Promise<void> {
    const now = new Date();
    // Fields listed explicitly so nothing outside this shape can be written.
    const values = {
      userId: conn.userId,
      orgId: conn.orgId,
      sfUserId: conn.sfUserId,
      username: conn.username,
      instanceUrl: conn.instanceUrl,
      loginUrl: conn.loginUrl,
      accessTokenEnc: conn.accessTokenEnc,
      refreshTokenEnc: conn.refreshTokenEnc,
    };
    await this.db
      .insert(salesforceConnections)
      .values({ ...values, connectedAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: salesforceConnections.userId, set: { ...values, connectedAt: now, updatedAt: now } });
  }

  async updateTokens(userId: string, tokens: { accessTokenEnc: string; instanceUrl: string; refreshTokenEnc?: string }): Promise<void> {
    await this.db
      .update(salesforceConnections)
      .set({
        accessTokenEnc: tokens.accessTokenEnc,
        instanceUrl: tokens.instanceUrl,
        ...(tokens.refreshTokenEnc ? { refreshTokenEnc: tokens.refreshTokenEnc } : {}),
        updatedAt: new Date(),
      })
      .where(eq(salesforceConnections.userId, userId));
  }

  async delete(userId: string): Promise<boolean> {
    const rows = await this.db.delete(salesforceConnections).where(eq(salesforceConnections.userId, userId)).returning({ userId: salesforceConnections.userId });
    return rows.length > 0;
  }

  async savePending(p: PendingHandshake): Promise<void> {
    // Opportunistic cleanup keeps the table from growing with abandoned handshakes.
    await this.db.delete(oauthPending).where(lt(oauthPending.expiresAt, new Date()));
    await this.db.insert(oauthPending).values({ ...p });
  }

  async consumePending(nonce: string, userId: string, now: Date): Promise<PendingHandshake | null> {
    const rows = await this.db
      .delete(oauthPending)
      .where(and(eq(oauthPending.nonce, nonce), eq(oauthPending.userId, userId), gt(oauthPending.expiresAt, now)))
      .returning();
    return rows[0] ?? null;
  }
}
