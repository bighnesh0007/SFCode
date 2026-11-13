/** Community problems: drafts (staging) and the live table. */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { problemDrafts, problems, type DraftCheck, type DraftStatus, type ProblemContent } from "../data/postgres/schema.ts";

export interface DraftRecord {
  id: string;
  authorId: string;
  status: DraftStatus;
  slug: string;
  content: ProblemContent;
  check: DraftCheck | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  publishedSlug: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublishedRecord {
  slug: string;
  ord: number;
  authorId: string;
  content: ProblemContent;
  active: boolean;
  publishedAt: Date;
}

export interface ProblemDraftRepository {
  create(authorId: string, slug: string, content: ProblemContent): Promise<DraftRecord>;
  find(id: string): Promise<DraftRecord | null>;
  byAuthor(authorId: string): Promise<DraftRecord[]>;
  byStatus(statuses: DraftStatus[]): Promise<DraftRecord[]>;
  /** Only while editable by the author; clears any previous check. */
  updateContent(id: string, slug: string, content: ProblemContent): Promise<boolean>;
  /** Moves `from` → `to` atomically; false if the draft wasn't in `from`. */
  transition(id: string, from: DraftStatus[], to: DraftStatus, fields?: { reviewedBy?: string; reviewNote?: string | null }): Promise<boolean>;
  setCheck(id: string, check: DraftCheck): Promise<void>;
  /** Inserts the live problem and marks the draft approved, in one transaction. False if the draft left "submitted". */
  publish(draftId: string, live: { slug: string; ord: number; authorId: string; approvedBy: string; content: ProblemContent }, note: string | null): Promise<boolean>;
  published(activeOnly: boolean): Promise<PublishedRecord[]>;
  setActive(slug: string, active: boolean): Promise<boolean>;
  countPublishedBy(authorId: string): Promise<number>;
}

export class PgProblemDraftRepository implements ProblemDraftRepository {
  constructor(private readonly db: PgDatabase) {}

  async create(authorId: string, slug: string, content: ProblemContent): Promise<DraftRecord> {
    const [row] = await this.db.insert(problemDrafts).values({ authorId, slug, content }).returning();
    if (!row) throw new Error("draft insert returned nothing");
    return row;
  }

  async find(id: string): Promise<DraftRecord | null> {
    const [row] = await this.db.select().from(problemDrafts).where(eq(problemDrafts.id, id)).limit(1);
    return row ?? null;
  }

  async byAuthor(authorId: string): Promise<DraftRecord[]> {
    return this.db.select().from(problemDrafts).where(eq(problemDrafts.authorId, authorId)).orderBy(desc(problemDrafts.updatedAt));
  }

  async byStatus(statuses: DraftStatus[]): Promise<DraftRecord[]> {
    return this.db.select().from(problemDrafts).where(inArray(problemDrafts.status, statuses)).orderBy(problemDrafts.updatedAt);
  }

  async updateContent(id: string, slug: string, content: ProblemContent): Promise<boolean> {
    const rows = await this.db
      .update(problemDrafts)
      .set({ slug, content, check: null, updatedAt: sql`now()` })
      .where(and(eq(problemDrafts.id, id), inArray(problemDrafts.status, ["draft", "changes_requested"])))
      .returning({ id: problemDrafts.id });
    return rows.length > 0;
  }

  async transition(id: string, from: DraftStatus[], to: DraftStatus, fields: { reviewedBy?: string; reviewNote?: string | null } = {}): Promise<boolean> {
    const rows = await this.db
      .update(problemDrafts)
      .set({ status: to, ...fields, updatedAt: sql`now()` })
      .where(and(eq(problemDrafts.id, id), inArray(problemDrafts.status, from)))
      .returning({ id: problemDrafts.id });
    return rows.length > 0;
  }

  async setCheck(id: string, check: DraftCheck): Promise<void> {
    await this.db.update(problemDrafts).set({ check }).where(eq(problemDrafts.id, id));
  }

  async publish(draftId: string, live: { slug: string; ord: number; authorId: string; approvedBy: string; content: ProblemContent }, note: string | null): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const moved = await tx
        .update(problemDrafts)
        .set({ status: "approved", reviewedBy: live.approvedBy, reviewNote: note, publishedSlug: live.slug, updatedAt: sql`now()` })
        .where(and(eq(problemDrafts.id, draftId), eq(problemDrafts.status, "submitted")))
        .returning({ id: problemDrafts.id });
      if (moved.length === 0) return false;
      await tx.insert(problems).values({ ...live, draftId });
      return true;
    });
  }

  async published(activeOnly: boolean): Promise<PublishedRecord[]> {
    const q = this.db.select({ slug: problems.slug, ord: problems.ord, authorId: problems.authorId, content: problems.content, active: problems.active, publishedAt: problems.publishedAt }).from(problems);
    return (activeOnly ? q.where(eq(problems.active, true)) : q).orderBy(problems.ord);
  }

  async setActive(slug: string, active: boolean): Promise<boolean> {
    const rows = await this.db.update(problems).set({ active }).where(eq(problems.slug, slug)).returning({ slug: problems.slug });
    return rows.length > 0;
  }

  async countPublishedBy(authorId: string): Promise<number> {
    const [row] = await this.db.select({ n: sql<number>`count(*)::int` }).from(problems).where(and(eq(problems.authorId, authorId), eq(problems.active, true)));
    return row?.n ?? 0;
  }
}
