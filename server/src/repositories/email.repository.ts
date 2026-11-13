/** Email preferences (opt-in) and the send log that enforces the caps. */
import { and, eq, gte, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { emailLog, emailPrefs } from "../data/postgres/schema.ts";

export type ClaimOutcome = "claimed" | "duplicate" | "user_cap" | "global_cap";

export interface EmailRepository {
  prefs(userId: string): Promise<{ weeklyDigest: boolean }>;
  setPrefs(userId: string, weeklyDigest: boolean): Promise<void>;
  digestSubscribers(): Promise<string[]>;
  /**
   * Reserves one send for (user, kind, period) if both monthly caps allow it,
   * atomically (a global advisory lock), so concurrent runs can't overshoot.
   */
  claim(userId: string, kind: string, period: string, monthStart: Date, caps: { total: number; perUser: number }): Promise<ClaimOutcome>;
  markFailed(userId: string, kind: string, period: string): Promise<void>;
  sentThisMonth(monthStart: Date): Promise<number>;
}

export class PgEmailRepository implements EmailRepository {
  constructor(private readonly db: PgDatabase) {}

  async prefs(userId: string): Promise<{ weeklyDigest: boolean }> {
    const [row] = await this.db.select({ weeklyDigest: emailPrefs.weeklyDigest }).from(emailPrefs).where(eq(emailPrefs.userId, userId)).limit(1);
    return { weeklyDigest: row?.weeklyDigest ?? false };
  }

  async setPrefs(userId: string, weeklyDigest: boolean): Promise<void> {
    await this.db
      .insert(emailPrefs)
      .values({ userId, weeklyDigest })
      .onConflictDoUpdate({ target: emailPrefs.userId, set: { weeklyDigest, updatedAt: sql`now()` } });
  }

  async digestSubscribers(): Promise<string[]> {
    return (await this.db.select({ id: emailPrefs.userId }).from(emailPrefs).where(eq(emailPrefs.weeklyDigest, true))).map((r) => r.id);
  }

  async claim(userId: string, kind: string, period: string, monthStart: Date, caps: { total: number; perUser: number }): Promise<ClaimOutcome> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('email:monthly'))`);
      const [dup] = await tx
        .select({ id: emailLog.id })
        .from(emailLog)
        .where(and(eq(emailLog.userId, userId), eq(emailLog.kind, kind), eq(emailLog.period, period)))
        .limit(1);
      if (dup) return "duplicate";
      // Failed attempts count too: the provider may have counted them.
      const [total] = await tx.select({ n: sql<number>`count(*)::int` }).from(emailLog).where(gte(emailLog.sentAt, monthStart));
      if ((total?.n ?? 0) >= caps.total) return "global_cap";
      const [mine] = await tx.select({ n: sql<number>`count(*)::int` }).from(emailLog).where(and(eq(emailLog.userId, userId), gte(emailLog.sentAt, monthStart)));
      if ((mine?.n ?? 0) >= caps.perUser) return "user_cap";
      await tx.insert(emailLog).values({ userId, kind, period, status: "sent" });
      return "claimed";
    });
  }

  async markFailed(userId: string, kind: string, period: string): Promise<void> {
    await this.db.update(emailLog).set({ status: "failed" }).where(and(eq(emailLog.userId, userId), eq(emailLog.kind, kind), eq(emailLog.period, period)));
  }

  async sentThisMonth(monthStart: Date): Promise<number> {
    const [row] = await this.db.select({ n: sql<number>`count(*)::int` }).from(emailLog).where(gte(emailLog.sentAt, monthStart));
    return row?.n ?? 0;
  }
}
