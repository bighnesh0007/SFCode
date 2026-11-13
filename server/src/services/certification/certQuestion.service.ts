/**
 * Certification questions written by Buddies:
 *
 *   submitted ─(reviewer)→ approved (joins the practice pool) | changes_requested | rejected
 *   changes_requested ─(author edits)→ submitted
 *
 * Approved questions are practised alongside the bank's own but never appear in
 * mock exams, which stay on the reviewed bank. A reviewer can't approve their own
 * question (the owner excepted, as with problems).
 */
import { z } from "zod";
import type { CertQuestionContent } from "../../data/postgres/schema.ts";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../errors/AppError.ts";
import { logEvent, logger } from "../../lib/logger.ts";
import type { CertQuestionRecord, CertQuestionRepository } from "../../repositories/certQuestion.repository.ts";
import type { ProfileRepository } from "../../repositories/profile.repository.ts";
import type { AdminService } from "../admin/admin.service.ts";
import { validateQuestion, type QuestionBank } from "./bank.ts";

export const certQuestionSchema = z.strictObject({
  exam: z.string().regex(/^[a-z0-9-]{1,40}$/),
  section: z.string().regex(/^[a-z0-9-]{1,40}$/),
  prompt: z.string().trim().min(10).max(2000),
  options: z.array(z.strictObject({ id: z.string().regex(/^[a-h]$/), text: z.string().trim().min(1).max(500) })).min(3).max(6),
  answer: z.array(z.string().regex(/^[a-h]$/)).min(1).max(5),
  explanation: z.string().trim().min(20).max(2000),
});

/** The id a question gets in the bank: stable, and can't collide with the hand-written ids. */
export const bankId = (draftId: string) => `cq-${draftId.slice(0, 8)}`;

export type Notifier = (userId: string, kind: "review", data: Record<string, string>) => Promise<void>;

export class CertQuestionService {
  private notifier: Notifier | undefined;
  setNotifier(fn: Notifier): void {
    this.notifier = fn;
  }
  private tell(userId: string, data: Record<string, string>): void {
    void this.notifier?.(userId, "review", data).catch(() => undefined);
  }

  constructor(
    private readonly repo: CertQuestionRepository,
    private readonly bank: QuestionBank,
    private readonly admin: AdminService,
    private readonly profiles: ProfileRepository,
  ) {}

  /** Adds every approved, active question to the bank. A broken one is skipped and logged, never fatal. */
  async loadApproved(): Promise<number> {
    let n = 0;
    for (const r of await this.repo.byStatus(["approved"])) {
      if (!r.active) continue;
      try {
        this.bank.addCommunity(r.content.exam, this.toQuestion(r));
        n++;
      } catch (err) {
        logger.warn({ id: r.id, err }, "skipped a community certification question");
      }
    }
    return n;
  }

  private toQuestion(r: { id: string; content: CertQuestionContent }) {
    const { section, prompt, options, answer, explanation } = r.content;
    return { id: bankId(r.id), section, prompt, options, answer: [...answer].sort(), explanation };
  }

  /** Same rules as the bank files, so an approved question can always be loaded. */
  private check(content: CertQuestionContent): void {
    const exam = this.bank.exam(content.exam);
    if (!exam) throw new BadRequestError("Pick an exam from the list.");
    try {
      validateQuestion({ id: "new", ...content }, new Set(exam.sections.map((s) => s.id)), "question");
    } catch (err) {
      throw new BadRequestError((err instanceof Error ? err.message : String(err)).replace(/^question: /, ""));
    }
  }

  private view(r: CertQuestionRecord, author: string | null) {
    const exam = this.bank.exam(r.content.exam);
    return {
      id: r.id,
      status: r.status,
      content: r.content,
      examTitle: exam?.title ?? r.content.exam,
      sectionTitle: exam?.sections.find((s) => s.id === r.content.section)?.title ?? r.content.section,
      reviewNote: r.reviewNote,
      active: r.active,
      author,
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private async handles(ids: string[]): Promise<Map<string, string>> {
    return new Map((await this.profiles.findByUsers([...new Set(ids)])).map((p) => [p.userId, p.handle]));
  }

  async submit(actor: string, content: CertQuestionContent) {
    await this.admin.require(actor, "buddy");
    this.check(content);
    const r = await this.repo.create(actor, content);
    logEvent("cert_question.submitted", { id: r.id, exam: content.exam });
    return this.view(r, null);
  }

  async edit(actor: string, id: string, content: CertQuestionContent) {
    await this.admin.require(actor, "buddy");
    const r = await this.repo.find(id);
    if (r?.authorId !== actor) throw new NotFoundError("No such question.");
    this.check(content);
    if (!(await this.repo.edit(id, actor, content))) throw new ConflictError("This question has already been reviewed and can't be edited.");
    return this.view({ ...r, content, status: "submitted" }, null);
  }

  async mine(actor: string) {
    await this.admin.require(actor, "buddy");
    return (await this.repo.byAuthor(actor)).map((r) => this.view(r, null));
  }

  async queue(actor: string) {
    await this.admin.require(actor, "reviewer");
    const rows = await this.repo.byStatus(["submitted"]);
    const handles = await this.handles(rows.map((r) => r.authorId));
    return rows.map((r) => this.view(r, handles.get(r.authorId) ?? null));
  }

  async decide(actor: string, id: string, action: "approve" | "changes" | "reject", note: string) {
    const standing = await this.admin.require(actor, "reviewer");
    const r = await this.repo.find(id);
    if (!r) throw new NotFoundError("No such question.");
    if (r.status !== "submitted") throw new ConflictError("Only submitted questions can be reviewed.");
    if (r.authorId === actor && standing !== "owner") throw new ForbiddenError("You can't review your own question.");
    const reviewNote = note.trim() || null;
    if (action === "changes" && !reviewNote) throw new BadRequestError("Tell the author what to change.");
    if (action === "approve") this.check(r.content);
    const to = action === "approve" ? "approved" : action === "changes" ? "changes_requested" : "rejected";
    if (!(await this.repo.transition(id, ["submitted"], to, { reviewedBy: actor, reviewNote }))) throw new ConflictError("Someone else just reviewed this question.");
    if (action === "approve") this.bank.addCommunity(r.content.exam, this.toQuestion(r));
    logEvent("cert_question.reviewed", { id, action, by: actor });
    this.tell(r.authorId, { cert: "yes", action: to, exam: r.content.exam, prompt: r.content.prompt.slice(0, 80) });
    return this.view({ ...r, status: to, reviewNote }, null);
  }

  /** Admins take an approved question out of practice (or put it back). Past attempts are kept. */
  async setActive(actor: string, id: string, active: boolean): Promise<void> {
    await this.admin.require(actor, "admin");
    const r = await this.repo.find(id);
    if (r?.status !== "approved") throw new NotFoundError("No such approved question.");
    if (!(await this.repo.setActive(id, active))) throw new ConflictError("That didn't change anything.");
    if (active) this.bank.addCommunity(r.content.exam, this.toQuestion(r));
    else this.bank.removeCommunity(bankId(r.id));
    logEvent("cert_question.visibility", { id, active, by: actor });
  }
}
