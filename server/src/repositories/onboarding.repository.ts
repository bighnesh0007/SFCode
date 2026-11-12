/** The welcome-quiz answers and per-user roadmap marks. */
import { eq, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { userOnboarding } from "../data/postgres/schema.ts";

export interface OnboardingRecord {
  userId: string;
  role: string;
  level: string;
  goal: string;
  hours: string;
  roadmapId: string;
  readNodes: string[];
}

export interface OnboardingRepository {
  get(userId: string): Promise<OnboardingRecord | null>;
  /** Saves quiz answers; keeps the user's read marks when they redo the quiz. */
  save(rec: Omit<OnboardingRecord, "readNodes">): Promise<OnboardingRecord>;
  setRead(userId: string, nodeId: string, read: boolean): Promise<string[] | null>;
}

export class PgOnboardingRepository implements OnboardingRepository {
  constructor(private readonly db: PgDatabase) {}

  async get(userId: string): Promise<OnboardingRecord | null> {
    const [row] = await this.db.select().from(userOnboarding).where(eq(userOnboarding.userId, userId)).limit(1);
    return row ?? null;
  }

  async save(rec: Omit<OnboardingRecord, "readNodes">): Promise<OnboardingRecord> {
    const { userId, ...answers } = rec;
    const [row] = await this.db
      .insert(userOnboarding)
      .values(rec)
      .onConflictDoUpdate({ target: userOnboarding.userId, set: { ...answers, updatedAt: sql`now()` } })
      .returning();
    if (!row) throw new Error(`onboarding upsert returned nothing for ${userId}`);
    return row;
  }

  async setRead(userId: string, nodeId: string, read: boolean): Promise<string[] | null> {
    // One statement, so two tabs toggling different nodes can't lose a mark.
    const expr = read
      ? sql`(SELECT coalesce(jsonb_agg(DISTINCT v), '[]'::jsonb) FROM jsonb_array_elements_text(${userOnboarding.readNodes} || jsonb_build_array(${nodeId}::text)) v)`
      : sql`(${userOnboarding.readNodes} - ${nodeId}::text)`;
    const [row] = await this.db.update(userOnboarding).set({ readNodes: expr, updatedAt: sql`now()` }).where(eq(userOnboarding.userId, userId)).returning({ readNodes: userOnboarding.readNodes });
    return row?.readNodes ?? null;
  }
}
