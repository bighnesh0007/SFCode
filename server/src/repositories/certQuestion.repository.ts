/** Contributor certification questions: submissions, reviews and the approved pool. */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { certQuestionDrafts, type CertQuestionContent, type CertQuestionStatus } from "../data/postgres/schema.ts";

export interface CertQuestionRecord {
  id: string;
  authorId: string;
  status: CertQuestionStatus;
  content: CertQuestionContent;
  reviewNote: string | null;
  reviewedBy: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CertQuestionRepository {
  create(authorId: string, content: CertQuestionContent): Promise<CertQuestionRecord>;
  find(id: string): Promise<CertQuestionRecord | null>;
  byAuthor(authorId: string): Promise<CertQuestionRecord[]>;
  byStatus(statuses: CertQuestionStatus[]): Promise<CertQuestionRecord[]>;
  /** Replaces the content and resubmits, only if it's still editable. */
  edit(id: string, authorId: string, content: CertQuestionContent): Promise<boolean>;
  /** Moves from one of `from` to `to`; false if someone else got there first. */
  transition(id: string, from: CertQuestionStatus[], to: CertQuestionStatus, review: { reviewedBy: string; reviewNote: string | null }): Promise<boolean>;
  setActive(id: string, active: boolean): Promise<boolean>;
}

export class PgCertQuestionRepository implements CertQuestionRepository {
  constructor(private readonly db: PgDatabase) {}

  async create(authorId: string, content: CertQuestionContent): Promise<CertQuestionRecord> {
    const [row] = await this.db.insert(certQuestionDrafts).values({ authorId, content }).returning();
    if (!row) throw new Error("insert returned no row");
    return row;
  }

  async find(id: string): Promise<CertQuestionRecord | null> {
    const [row] = await this.db.select().from(certQuestionDrafts).where(eq(certQuestionDrafts.id, id)).limit(1);
    return row ?? null;
  }

  byAuthor(authorId: string): Promise<CertQuestionRecord[]> {
    return this.db.select().from(certQuestionDrafts).where(eq(certQuestionDrafts.authorId, authorId)).orderBy(desc(certQuestionDrafts.updatedAt));
  }

  byStatus(statuses: CertQuestionStatus[]): Promise<CertQuestionRecord[]> {
    return this.db.select().from(certQuestionDrafts).where(inArray(certQuestionDrafts.status, statuses)).orderBy(certQuestionDrafts.updatedAt);
  }

  async edit(id: string, authorId: string, content: CertQuestionContent): Promise<boolean> {
    const rows = await this.db
      .update(certQuestionDrafts)
      .set({ content, status: "submitted", updatedAt: sql`now()` })
      .where(and(eq(certQuestionDrafts.id, id), eq(certQuestionDrafts.authorId, authorId), inArray(certQuestionDrafts.status, ["submitted", "changes_requested"])))
      .returning({ id: certQuestionDrafts.id });
    return rows.length > 0;
  }

  async transition(id: string, from: CertQuestionStatus[], to: CertQuestionStatus, review: { reviewedBy: string; reviewNote: string | null }): Promise<boolean> {
    const rows = await this.db
      .update(certQuestionDrafts)
      .set({ status: to, reviewedBy: review.reviewedBy, reviewNote: review.reviewNote, updatedAt: sql`now()` })
      .where(and(eq(certQuestionDrafts.id, id), inArray(certQuestionDrafts.status, from)))
      .returning({ id: certQuestionDrafts.id });
    return rows.length > 0;
  }

  async setActive(id: string, active: boolean): Promise<boolean> {
    const rows = await this.db.update(certQuestionDrafts).set({ active, updatedAt: sql`now()` }).where(and(eq(certQuestionDrafts.id, id), eq(certQuestionDrafts.status, "approved"))).returning({ id: certQuestionDrafts.id });
    return rows.length > 0;
  }
}
