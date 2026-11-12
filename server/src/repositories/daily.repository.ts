/** Problem-of-the-day picks, and who solved the day's problem on that day. */
import { eq, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { dailyChallenges } from "../data/postgres/schema.ts";

export interface DailyRepository {
  /** The pick for `day`, inserting `candidate` if none exists yet (first writer wins). */
  getOrCreate(day: string, candidate: string): Promise<string>;
  /** Days on which the user solved that day's problem (by submission time, UTC). */
  wins(userId: string): Promise<string[]>;
}

export class PgDailyRepository implements DailyRepository {
  constructor(private readonly db: PgDatabase) {}

  async getOrCreate(day: string, candidate: string): Promise<string> {
    await this.db.insert(dailyChallenges).values({ day, problemSlug: candidate }).onConflictDoNothing();
    const [row] = await this.db.select({ slug: dailyChallenges.problemSlug }).from(dailyChallenges).where(eq(dailyChallenges.day, day)).limit(1);
    return row?.slug ?? candidate;
  }

  async wins(userId: string): Promise<string[]> {
    // Fully qualified names: drizzle renders interpolated columns unqualified.
    const res = await this.db.execute<{ day: string }>(sql`
      SELECT DISTINCT d.day
      FROM daily_challenges d
      JOIN challenge_submissions s
        ON s.problem_slug = d.problem_slug
       AND s.status = 'accepted'
       AND to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') = d.day
      WHERE s.user_id = ${userId}
      ORDER BY d.day`);
    return res.rows.map((r) => r.day);
  }
}
