/** Persistence for Certification Prep answers. */
import { and, desc, eq } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { certAttempts } from "../data/postgres/schema.ts";

export interface CertAttemptRepository {
  record(input: { userId: string; exam: string; questionId: string; correct: boolean }): Promise<void>;
  /** Latest outcome per question for one user and exam. */
  latest(userId: string, exam: string): Promise<Map<string, boolean>>;
}

export class PgCertAttemptRepository implements CertAttemptRepository {
  constructor(private readonly db: PgDatabase) {}

  async record(input: { userId: string; exam: string; questionId: string; correct: boolean }): Promise<void> {
    await this.db.insert(certAttempts).values({ userId: input.userId, exam: input.exam, questionId: input.questionId, correct: input.correct });
  }

  async latest(userId: string, exam: string): Promise<Map<string, boolean>> {
    const rows = await this.db
      .selectDistinctOn([certAttempts.questionId], { questionId: certAttempts.questionId, correct: certAttempts.correct })
      .from(certAttempts)
      .where(and(eq(certAttempts.userId, userId), eq(certAttempts.exam, exam)))
      .orderBy(certAttempts.questionId, desc(certAttempts.answeredAt));
    return new Map(rows.map((r) => [r.questionId, r.correct]));
  }
}
