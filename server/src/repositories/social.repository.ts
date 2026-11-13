/** Follows and notifications. */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { follows, notifications, type NotificationKind } from "../data/postgres/schema.ts";

export interface NotificationRecord {
  id: string;
  kind: NotificationKind;
  data: Record<string, string>;
  readAt: Date | null;
  createdAt: Date;
}

export interface SocialRepository {
  /** False if already following. */
  follow(followerId: string, followeeId: string): Promise<boolean>;
  unfollow(followerId: string, followeeId: string): Promise<boolean>;
  isFollowing(followerId: string, followeeId: string): Promise<boolean>;
  following(userId: string): Promise<string[]>;
  counts(userId: string): Promise<{ followers: number; following: number }>;
  notify(userId: string, kind: NotificationKind, data: Record<string, string>): Promise<void>;
  notificationsFor(userId: string, limit: number): Promise<NotificationRecord[]>;
  unreadCount(userId: string): Promise<number>;
  markAllRead(userId: string): Promise<void>;
}

export class PgSocialRepository implements SocialRepository {
  constructor(private readonly db: PgDatabase) {}

  async follow(followerId: string, followeeId: string): Promise<boolean> {
    const rows = await this.db.insert(follows).values({ followerId, followeeId }).onConflictDoNothing().returning({ f: follows.followerId });
    return rows.length > 0;
  }

  async unfollow(followerId: string, followeeId: string): Promise<boolean> {
    const rows = await this.db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId))).returning({ f: follows.followerId });
    return rows.length > 0;
  }

  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    const [row] = await this.db.select({ f: follows.followerId }).from(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId))).limit(1);
    return row !== undefined;
  }

  async following(userId: string): Promise<string[]> {
    return (await this.db.select({ id: follows.followeeId }).from(follows).where(eq(follows.followerId, userId))).map((r) => r.id);
  }

  async counts(userId: string): Promise<{ followers: number; following: number }> {
    const [row] = await this.db
      .select({
        followers: sql<number>`count(*) filter (where ${follows.followeeId} = ${userId})::int`,
        following: sql<number>`count(*) filter (where ${follows.followerId} = ${userId})::int`,
      })
      .from(follows);
    return { followers: row?.followers ?? 0, following: row?.following ?? 0 };
  }

  async notify(userId: string, kind: NotificationKind, data: Record<string, string>): Promise<void> {
    await this.db.insert(notifications).values({ userId, kind, data });
  }

  async notificationsFor(userId: string, limit: number): Promise<NotificationRecord[]> {
    return this.db
      .select({ id: notifications.id, kind: notifications.kind, data: notifications.data, readAt: notifications.readAt, createdAt: notifications.createdAt })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async unreadCount(userId: string): Promise<number> {
    const [row] = await this.db.select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.n ?? 0;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db.update(notifications).set({ readAt: sql`now()` }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  }
}
