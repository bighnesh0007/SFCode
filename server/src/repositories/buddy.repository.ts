/** Applications to become a Buddy. */
import { and, desc, eq } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { buddyApplications } from "../data/postgres/schema.ts";
import { isUniqueViolation } from "./pgErrors.ts";

export interface BuddyApplication {
  id: string;
  userId: string;
  motivation: string;
  link: string | null;
  status: "pending" | "approved" | "rejected";
  decidedBy: string | null;
  note: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}

export interface BuddyRepository {
  /** Returns null if the user already has a pending application. */
  create(userId: string, motivation: string, link: string | null): Promise<BuddyApplication | null>;
  latestFor(userId: string): Promise<BuddyApplication | null>;
  pending(): Promise<BuddyApplication[]>;
  find(id: string): Promise<BuddyApplication | null>;
  /** Only decides a pending application; false if it was already decided. */
  decide(id: string, status: "approved" | "rejected", by: string, note: string | null): Promise<boolean>;
}

export class PgBuddyRepository implements BuddyRepository {
  constructor(private readonly db: PgDatabase) {}

  async create(userId: string, motivation: string, link: string | null): Promise<BuddyApplication | null> {
    try {
      const [row] = await this.db.insert(buddyApplications).values({ userId, motivation, link }).returning();
      return row ?? null;
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }

  async latestFor(userId: string): Promise<BuddyApplication | null> {
    const [row] = await this.db.select().from(buddyApplications).where(eq(buddyApplications.userId, userId)).orderBy(desc(buddyApplications.createdAt)).limit(1);
    return row ?? null;
  }

  async pending(): Promise<BuddyApplication[]> {
    return this.db.select().from(buddyApplications).where(eq(buddyApplications.status, "pending")).orderBy(buddyApplications.createdAt);
  }

  async find(id: string): Promise<BuddyApplication | null> {
    const [row] = await this.db.select().from(buddyApplications).where(eq(buddyApplications.id, id)).limit(1);
    return row ?? null;
  }

  async decide(id: string, status: "approved" | "rejected", by: string, note: string | null): Promise<boolean> {
    const rows = await this.db
      .update(buddyApplications)
      .set({ status, decidedBy: by, note, decidedAt: new Date() })
      .where(and(eq(buddyApplications.id, id), eq(buddyApplications.status, "pending")))
      .returning({ id: buddyApplications.id });
    return rows.length > 0;
  }
}
