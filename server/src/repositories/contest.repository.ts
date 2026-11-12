/** Persistence for contests, their problems and entrants. */
import { and, asc, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { challengeSubmissions, contestEntries, contestProblems, contests } from "../data/postgres/schema.ts";
import type { SubmissionStatus } from "../domain/challenge.ts";

export interface ContestRecord {
  id: string;
  slug: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  createdBy: string;
  problems: { slug: string; position: number; points: number }[];
  entrants: number;
}

export interface ContestAttempt {
  userId: string;
  slug: string;
  status: SubmissionStatus;
  createdAt: Date;
}

export interface ContestRepository {
  create(c: { slug: string; title: string; startsAt: Date; endsAt: Date; createdBy: string; problems: { slug: string; points: number }[] }): Promise<ContestRecord | null>;
  list(): Promise<ContestRecord[]>;
  findBySlug(slug: string): Promise<ContestRecord | null>;
  delete(id: string): Promise<void>;
  join(contestId: string, userId: string): Promise<void>;
  isEntrant(contestId: string, userId: string): Promise<boolean>;
  entrants(contestId: string): Promise<string[]>;
  /** A live contest the user joined that includes this problem, if any. */
  liveContestFor(userId: string, problemSlug: string, now: Date): Promise<string | null>;
  attempts(contestId: string): Promise<ContestAttempt[]>;
}

const isUniqueViolation = (err: unknown): boolean => {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
};

export class PgContestRepository implements ContestRepository {
  constructor(private readonly db: PgDatabase) {}

  async create(c: { slug: string; title: string; startsAt: Date; endsAt: Date; createdBy: string; problems: { slug: string; points: number }[] }): Promise<ContestRecord | null> {
    try {
      await this.db.transaction(async (tx) => {
        const [row] = await tx.insert(contests).values({ slug: c.slug, title: c.title, startsAt: c.startsAt, endsAt: c.endsAt, createdBy: c.createdBy }).returning({ id: contests.id });
        if (!row) throw new Error("contest insert returned nothing");
        await tx.insert(contestProblems).values(c.problems.map((p, i) => ({ contestId: row.id, problemSlug: p.slug, position: i + 1, points: p.points })));
      });
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
    return this.findBySlug(c.slug);
  }

  private async hydrate(rows: (typeof contests.$inferSelect)[]): Promise<ContestRecord[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const problems = await this.db.select().from(contestProblems).where(inArray(contestProblems.contestId, ids)).orderBy(asc(contestProblems.position));
    const counts = await this.db
      .select({ contestId: contestEntries.contestId, n: sql<number>`count(*)::int` })
      .from(contestEntries)
      .where(inArray(contestEntries.contestId, ids))
      .groupBy(contestEntries.contestId);
    return rows.map((r) => ({
      ...r,
      problems: problems.filter((p) => p.contestId === r.id).map((p) => ({ slug: p.problemSlug, position: p.position, points: p.points })),
      entrants: counts.find((c) => c.contestId === r.id)?.n ?? 0,
    }));
  }

  async list(): Promise<ContestRecord[]> {
    return this.hydrate(await this.db.select().from(contests).orderBy(desc(contests.startsAt)).limit(100));
  }

  async findBySlug(slug: string): Promise<ContestRecord | null> {
    const [c] = await this.hydrate(await this.db.select().from(contests).where(eq(contests.slug, slug)).limit(1));
    return c ?? null;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(contests).where(eq(contests.id, id));
  }

  async join(contestId: string, userId: string): Promise<void> {
    await this.db.insert(contestEntries).values({ contestId, userId }).onConflictDoNothing();
  }

  async isEntrant(contestId: string, userId: string): Promise<boolean> {
    const rows = await this.db.select({ u: contestEntries.userId }).from(contestEntries).where(and(eq(contestEntries.contestId, contestId), eq(contestEntries.userId, userId))).limit(1);
    return rows.length > 0;
  }

  async entrants(contestId: string): Promise<string[]> {
    const rows = await this.db.select({ u: contestEntries.userId }).from(contestEntries).where(eq(contestEntries.contestId, contestId));
    return rows.map((r) => r.u);
  }

  async liveContestFor(userId: string, problemSlug: string, now: Date): Promise<string | null> {
    const rows = await this.db
      .select({ id: contests.id })
      .from(contests)
      .innerJoin(contestProblems, eq(contestProblems.contestId, contests.id))
      .innerJoin(contestEntries, and(eq(contestEntries.contestId, contests.id), eq(contestEntries.userId, userId)))
      .where(and(eq(contestProblems.problemSlug, problemSlug), lte(contests.startsAt, now), gt(contests.endsAt, now)))
      .orderBy(asc(contests.endsAt))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  async attempts(contestId: string): Promise<ContestAttempt[]> {
    const t = challengeSubmissions;
    return this.db
      .select({ userId: t.userId, slug: t.problemSlug, status: t.status, createdAt: t.createdAt })
      .from(t)
      .where(eq(t.contestId, contestId))
      .orderBy(asc(t.createdAt));
  }
}
