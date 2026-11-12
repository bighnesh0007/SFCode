/** Persistence for challenge submissions. */
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { challengeSubmissions } from "../data/postgres/schema.ts";
import type { GradeResult, SubmissionStatus } from "../domain/challenge.ts";

export interface SubmissionRecord {
  id: string;
  userId: string;
  problemSlug: string;
  orgId: string;
  status: SubmissionStatus;
  deployId: string | null;
  files: Record<string, string>;
  result: GradeResult | null;
  createdAt: Date;
  checkedAt: Date | null;
  completedAt: Date | null;
}

export interface ChallengeSubmissionRepository {
  /** Inserts a running submission; returns null if the user already has one running. */
  createRunning(input: { userId: string; problemSlug: string; orgId: string; files: Record<string, string> }): Promise<SubmissionRecord | null>;
  setDeployId(id: string, deployId: string): Promise<void>;
  markChecked(id: string, at: Date): Promise<void>;
  /** Finalises only if still running, so two concurrent pollers cannot overwrite each other. */
  complete(id: string, status: Exclude<SubmissionStatus, "running">, result: GradeResult, at: Date): Promise<boolean>;
  findById(id: string): Promise<SubmissionRecord | null>;
  listForProblem(userId: string, problemSlug: string, limit: number): Promise<SubmissionRecord[]>;
  /** Per problem: whether the user has an accepted submission, or only attempts. */
  progress(userId: string): Promise<Map<string, "solved" | "attempted">>;
  /** First accepted time per (user, problem), optionally for solves since a date. All users. */
  firstSolves(since?: Date): Promise<{ userId: string; slug: string; at: Date }[]>;
  /** Submissions per UTC day for one user since a date (any verdict). */
  dailyActivity(userId: string, since: Date): Promise<{ day: string; count: number }[]>;
}

export class PgChallengeSubmissionRepository implements ChallengeSubmissionRepository {
  constructor(private readonly db: PgDatabase) {}

  async createRunning(input: { userId: string; problemSlug: string; orgId: string; files: Record<string, string> }): Promise<SubmissionRecord | null> {
    const rows = await this.db
      .insert(challengeSubmissions)
      .values({ userId: input.userId, problemSlug: input.problemSlug, orgId: input.orgId, files: input.files, status: "running" })
      .onConflictDoNothing()
      .returning();
    return (rows[0] as SubmissionRecord | undefined) ?? null;
  }

  async setDeployId(id: string, deployId: string): Promise<void> {
    await this.db.update(challengeSubmissions).set({ deployId }).where(eq(challengeSubmissions.id, id));
  }

  async markChecked(id: string, at: Date): Promise<void> {
    await this.db.update(challengeSubmissions).set({ checkedAt: at }).where(eq(challengeSubmissions.id, id));
  }

  async complete(id: string, status: Exclude<SubmissionStatus, "running">, result: GradeResult, at: Date): Promise<boolean> {
    const rows = await this.db
      .update(challengeSubmissions)
      .set({ status, result, completedAt: at })
      .where(and(eq(challengeSubmissions.id, id), eq(challengeSubmissions.status, "running")))
      .returning({ id: challengeSubmissions.id });
    return rows.length > 0;
  }

  async findById(id: string): Promise<SubmissionRecord | null> {
    const rows = await this.db.select().from(challengeSubmissions).where(eq(challengeSubmissions.id, id)).limit(1);
    return (rows[0] as SubmissionRecord | undefined) ?? null;
  }

  async listForProblem(userId: string, problemSlug: string, limit: number): Promise<SubmissionRecord[]> {
    const rows = await this.db
      .select()
      .from(challengeSubmissions)
      .where(and(eq(challengeSubmissions.userId, userId), eq(challengeSubmissions.problemSlug, problemSlug)))
      .orderBy(desc(challengeSubmissions.createdAt))
      .limit(limit);
    return rows;
  }

  async progress(userId: string): Promise<Map<string, "solved" | "attempted">> {
    const rows = await this.db
      .select({
        slug: challengeSubmissions.problemSlug,
        solved: sql<boolean>`bool_or(${challengeSubmissions.status} = 'accepted')`,
      })
      .from(challengeSubmissions)
      .where(eq(challengeSubmissions.userId, userId))
      .groupBy(challengeSubmissions.problemSlug);
    return new Map(rows.map((r) => [r.slug, r.solved ? "solved" : "attempted"]));
  }

  async firstSolves(since?: Date): Promise<{ userId: string; slug: string; at: Date }[]> {
    const t = challengeSubmissions;
    // completed_at is set on every finished submission, so min() is the first solve.
    const rows = await this.db
      .select({ userId: t.userId, slug: t.problemSlug, at: sql<Date>`min(${t.completedAt})`.mapWith((v: string | Date) => new Date(v)) })
      .from(t)
      .where(and(eq(t.status, "accepted"), ...(since ? [gte(t.completedAt, since)] : [])))
      .groupBy(t.userId, t.problemSlug);
    return rows;
  }

  async dailyActivity(userId: string, since: Date): Promise<{ day: string; count: number }[]> {
    const t = challengeSubmissions;
    const day = sql<string>`to_char(${t.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
    return this.db
      .select({ day, count: sql<number>`count(*)::int` })
      .from(t)
      .where(and(eq(t.userId, userId), gte(t.createdAt, since)))
      .groupBy(day)
      .orderBy(day);
  }
}
