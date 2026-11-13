/** Problem discussion comments. */
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { problemComments } from "../data/postgres/schema.ts";

export interface DiscussionComment {
  id: string;
  problemSlug: string;
  authorId: string;
  body: string;
  spoiler: boolean;
  status: "published" | "hidden";
  createdAt: Date;
}

export interface DiscussionRepository {
  list(problemSlug: string, includeHidden: boolean): Promise<DiscussionComment[]>;
  add(c: { problemSlug: string; authorId: string; body: string; spoiler: boolean }): Promise<DiscussionComment>;
  find(id: string): Promise<DiscussionComment | null>;
  setStatus(id: string, status: "published" | "hidden"): Promise<void>;
  delete(id: string): Promise<void>;
  /** Comments this user posted since `since`, for the daily cap. */
  countSince(authorId: string, since: Date): Promise<number>;
  recent(limit: number): Promise<DiscussionComment[]>;
  /** Published comment counts for these problems. */
  counts(slugs: string[]): Promise<Map<string, number>>;
}

export class PgDiscussionRepository implements DiscussionRepository {
  constructor(private readonly db: PgDatabase) {}

  list(problemSlug: string, includeHidden: boolean): Promise<DiscussionComment[]> {
    return this.db
      .select()
      .from(problemComments)
      .where(and(eq(problemComments.problemSlug, problemSlug), ...(includeHidden ? [] : [eq(problemComments.status, "published")])))
      .orderBy(asc(problemComments.createdAt))
      .limit(500);
  }

  async add(c: { problemSlug: string; authorId: string; body: string; spoiler: boolean }): Promise<DiscussionComment> {
    const [row] = await this.db.insert(problemComments).values(c).returning();
    if (!row) throw new Error("comment insert returned nothing");
    return row;
  }

  async find(id: string): Promise<DiscussionComment | null> {
    const [row] = await this.db.select().from(problemComments).where(eq(problemComments.id, id)).limit(1);
    return row ?? null;
  }

  async setStatus(id: string, status: "published" | "hidden"): Promise<void> {
    await this.db.update(problemComments).set({ status }).where(eq(problemComments.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(problemComments).where(eq(problemComments.id, id));
  }

  async countSince(authorId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(problemComments)
      .where(and(eq(problemComments.authorId, authorId), gte(problemComments.createdAt, since)));
    return row?.n ?? 0;
  }

  recent(limit: number): Promise<DiscussionComment[]> {
    return this.db.select().from(problemComments).orderBy(desc(problemComments.createdAt)).limit(limit);
  }

  async counts(slugs: string[]): Promise<Map<string, number>> {
    if (slugs.length === 0) return new Map();
    const rows = await this.db
      .select({ slug: problemComments.problemSlug, n: sql<number>`count(*)::int` })
      .from(problemComments)
      .where(and(inArray(problemComments.problemSlug, slugs), eq(problemComments.status, "published")))
      .groupBy(problemComments.problemSlug);
    return new Map(rows.map((r) => [r.slug, r.n]));
  }
}
