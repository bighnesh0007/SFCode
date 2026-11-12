/** Persistence for public user profiles. */
import { eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { userProfiles } from "../data/postgres/schema.ts";

export interface ProfileRecord {
  userId: string;
  handle: string;
  displayName: string;
  imageUrl: string | null;
  createdAt: Date;
}

export interface ProfileRepository {
  findByUser(userId: string): Promise<ProfileRecord | null>;
  findByHandle(handle: string): Promise<ProfileRecord | null>;
  findByUsers(userIds: string[]): Promise<ProfileRecord[]>;
  /** Inserts; returns false if the handle is taken (case-insensitively). */
  create(p: Omit<ProfileRecord, "createdAt">): Promise<boolean>;
  /** Returns false if the new handle is taken. */
  update(userId: string, changes: { handle?: string; displayName?: string }): Promise<boolean>;
}

/**
 * Postgres unique violation. Drizzle wraps driver errors, so the code is on
 * `cause`; checking only the top level never matched (a real clash surfaced
 * as a 500 instead of a retry — caught by the Postgres suite).
 */
const isUniqueViolation = (err: unknown): boolean => {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
};

export class PgProfileRepository implements ProfileRepository {
  constructor(private readonly db: PgDatabase) {}

  async findByUser(userId: string): Promise<ProfileRecord | null> {
    const rows = await this.db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    return rows[0] ?? null;
  }

  async findByHandle(handle: string): Promise<ProfileRecord | null> {
    const rows = await this.db.select().from(userProfiles).where(sql`lower(${userProfiles.handle}) = ${handle.toLowerCase()}`).limit(1);
    return rows[0] ?? null;
  }

  async findByUsers(userIds: string[]): Promise<ProfileRecord[]> {
    if (userIds.length === 0) return [];
    return this.db.select().from(userProfiles).where(inArray(userProfiles.userId, userIds));
  }

  async create(p: Omit<ProfileRecord, "createdAt">): Promise<boolean> {
    try {
      await this.db.insert(userProfiles).values({ userId: p.userId, handle: p.handle, displayName: p.displayName, imageUrl: p.imageUrl }).onConflictDoNothing({ target: userProfiles.userId });
      return true;
    } catch (err) {
      if (isUniqueViolation(err)) return false;
      throw err;
    }
  }

  async update(userId: string, changes: { handle?: string; displayName?: string }): Promise<boolean> {
    try {
      await this.db
        .update(userProfiles)
        .set({ ...(changes.handle ? { handle: changes.handle } : {}), ...(changes.displayName ? { displayName: changes.displayName } : {}), updatedAt: new Date() })
        .where(eq(userProfiles.userId, userId));
      return true;
    } catch (err) {
      if (isUniqueViolation(err)) return false;
      throw err;
    }
  }
}
