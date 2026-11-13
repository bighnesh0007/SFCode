/**
 * Community problems, written and published on the site (no git):
 *
 *   draft ─(author submits, after a passing check)→ submitted
 *   submitted ─(reviewer)→ approved (copied to the live table) | changes_requested | rejected
 *   changes_requested ─(author edits, re-checks, resubmits)→ submitted
 *
 * A "check" runs the draft in someone's own connected org with a check-only
 * deploy: the reference must pass and the starter must fail. Authors need a
 * passing check to submit; approval needs a passing check run by a reviewer
 * (not the author), on exactly the content being approved.
 *
 * Phase B supports org-graded code tracks (Apex, Debugging, SOQL).
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import type { DraftCheck, ProblemContent } from "../../data/postgres/schema.ts";
import type { Challenge, GradeResult } from "../../domain/challenge.ts";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../errors/AppError.ts";
import { logEvent, logger } from "../../lib/logger.ts";
import type { DraftRecord, ProblemDraftRepository } from "../../repositories/problemDraft.repository.ts";
import type { ProfileRepository } from "../../repositories/profile.repository.ts";
import type { Clock } from "../../types/ports.ts";
import type { AdminService } from "../admin/admin.service.ts";
import { buildChallenge, type ChallengeCatalog } from "../challenges/catalog.ts";

const apexName = z.string().regex(/^Sfc[A-Za-z0-9_]{1,37}$/, "Apex names start with Sfc (letters, digits, _)");
const source = z.string().max(60_000);
export const problemContentSchema = z.strictObject({
  title: z.string().trim().min(3).max(80),
  track: z.enum(["apex", "debug", "soql"]),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  category: z.string().trim().min(2).max(40),
  tags: z.array(z.string().trim().min(1).max(24)).max(6),
  statement: z.string().max(20_000),
  files: z.array(z.strictObject({ name: z.union([apexName, z.literal("query")]), type: z.enum(["class", "trigger", "soql"]) })).min(1).max(4),
  starter: z.record(z.string(), source),
  reference: z.record(z.string(), source),
  testClass: apexName,
  testSource: z.string().max(100_000),
});

/** Checks can take a few minutes; one stuck longer than this (e.g. a restart mid-run) may be restarted. */
const STALE_CHECK_MS = 10 * 60_000;

export interface OrgChecker {
  /** Check-only deploy of `sources` with the hidden tests, in `userId`'s connected org. */
  grade(userId: string, challenge: Challenge, sources: Record<string, string>): Promise<GradeResult>;
}

const hashOf = (c: ProblemContent) => createHash("sha256").update(JSON.stringify(c)).digest("hex");

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "problem";
}

export class ProblemDraftService {
  constructor(
    private readonly repo: ProblemDraftRepository,
    private readonly catalog: ChallengeCatalog,
    private readonly admin: AdminService,
    private readonly profiles: ProfileRepository,
    private readonly checker: OrgChecker | undefined,
    private readonly clock: Clock,
  ) {}

  /** Adds every active community problem to the catalog. A broken or clashing one is skipped and logged, never fatal. */
  async loadPublished(): Promise<number> {
    let n = 0;
    for (const p of await this.repo.published(true)) {
      try {
        this.catalog.add({ ...this.toChallenge(p.slug, p.ord, p.content), authorId: p.authorId });
        n++;
      } catch (err) {
        logger.error({ slug: p.slug, err: err instanceof Error ? err.message : String(err) }, "community problem skipped");
      }
    }
    return n;
  }

  private toChallenge(slug: string, order: number, c: ProblemContent): Challenge {
    const files = c.files.map((f) => {
      if (f.type !== "soql") return { name: f.name, type: f.type };
      if (f.name !== "query") throw new Error(`"${c.title}": the SOQL file must be named "query"`);
      return { name: "query" as const, type: "soql" as const };
    });
    return buildChallenge(
      {
        slug,
        meta: { title: c.title, track: c.track, difficulty: c.difficulty, category: c.category, order, tags: c.tags, files, testClass: c.testClass },
        statement: c.statement,
        starter: c.starter,
        reference: c.reference,
        testSource: c.testSource,
      },
      `"${c.title}"`,
    );
  }

  /** Everything that would stop this draft going live, as readable messages. Empty = ready. */
  problemsWith(content: ProblemContent): string[] {
    const out: string[] = [];
    if (content.statement.trim().length < 50) out.push("The statement is too short (at least 50 characters).");
    for (const f of content.files) {
      if (!(f.name in content.starter)) out.push(`Starter is missing ${f.name}.`);
      if (!(f.name in content.reference)) out.push(`Solution is missing ${f.name}.`);
    }
    try {
      const c = this.toChallenge(slugify(content.title), this.catalog.nextCommunityOrder(), content);
      const clash = this.catalog.conflict({ ...c, slug: `${c.slug}-${"x".repeat(8)}` });
      if (clash) out.push(clash.replace(/^the slug .* is taken$/, ""));
    } catch (err) {
      out.push((err instanceof Error ? err.message : String(err)).replace(/^"[^"]*": /, ""));
    }
    return out.filter(Boolean);
  }

  private async mustRead(actor: string, id: string): Promise<{ d: DraftRecord; staff: boolean }> {
    const d = await this.repo.find(id);
    if (!d) throw new NotFoundError("No such draft.");
    if (d.authorId === actor) return { d, staff: false };
    await this.admin.require(actor, "reviewer");
    return { d, staff: true };
  }

  private view(d: DraftRecord, authorHandle: string | null, can: { edit: boolean; review: boolean } = { edit: false, review: false }) {
    const fresh = d.check?.contentHash === hashOf(d.content);
    return {
      canEdit: can.edit,
      canReview: can.review,
      id: d.id,
      status: d.status,
      slug: d.slug,
      content: d.content,
      check: d.check ? { ...d.check, current: fresh } : null,
      reviewNote: d.reviewNote,
      publishedSlug: d.publishedSlug,
      updatedAt: d.updatedAt.toISOString(),
      author: authorHandle,
      problems: this.problemsWith(d.content),
    };
  }

  private async handles(ids: string[]): Promise<Map<string, string>> {
    return new Map((await this.profiles.findByUsers([...new Set(ids)])).map((p) => [p.userId, p.handle]));
  }

  async create(actor: string, content: ProblemContent) {
    await this.admin.require(actor, "buddy");
    const d = await this.repo.create(actor, slugify(content.title), content);
    return this.get(actor, d.id);
  }

  async mine(actor: string) {
    await this.admin.require(actor, "buddy");
    return (await this.repo.byAuthor(actor)).map((d) => ({ id: d.id, title: d.content.title, track: d.content.track, difficulty: d.content.difficulty, status: d.status, publishedSlug: d.publishedSlug, updatedAt: d.updatedAt.toISOString() }));
  }

  /** The draft as `actor` sees it, including what they may do with it (the UI follows; the server enforces). */
  async get(actor: string, id: string) {
    const { d, staff } = await this.mustRead(actor, id);
    const isOwner = (await this.admin.standing(actor)) === "owner";
    return this.view(d, (await this.handles([d.authorId])).get(d.authorId) ?? null, {
      edit: d.authorId === actor && (d.status === "draft" || d.status === "changes_requested"),
      review: (staff || isOwner) && d.status === "submitted" && (d.authorId !== actor || isOwner),
    });
  }

  async update(actor: string, id: string, content: ProblemContent) {
    const d = await this.repo.find(id);
    if (d?.authorId !== actor) throw new NotFoundError("No such draft.");
    if (!(await this.repo.updateContent(id, slugify(content.title), content))) throw new ConflictError("This draft is with reviewers; it can't be edited right now.");
    return this.get(actor, id);
  }

  /** Starts a check in the actor's org (author, or a reviewer before approving). Poll `get` for the result. */
  async check(actor: string, id: string) {
    const { d } = await this.mustRead(actor, id);
    if (!this.checker) throw new BadRequestError("Checking needs Salesforce to be configured on this server.");
    const running = d.check?.status === "running" && this.clock.nowMs() - Date.parse(d.check.at) < STALE_CHECK_MS;
    if (running) throw new ConflictError("A check is already running for this draft.");
    const issues = this.problemsWith(d.content);
    if (issues.length) throw new BadRequestError(`Fix these first: ${issues.join(" ")}`);
    const contentHash = hashOf(d.content);
    const base = { by: actor, at: this.clock.now().toISOString(), contentHash };
    await this.repo.setCheck(id, { ...base, status: "running" });
    void this.runCheck(id, actor, d.content, base);
    return this.get(actor, id);
  }

  private async runCheck(id: string, actor: string, content: ProblemContent, base: Omit<DraftCheck, "status">): Promise<void> {
    const checker = this.checker;
    if (!checker) return;
    let result: DraftCheck;
    try {
      const challenge = this.toChallenge(slugify(content.title), this.catalog.nextCommunityOrder(), content);
      const ref = await checker.grade(actor, challenge, content.reference);
      const starter = ref.verdict === "accepted" ? await checker.grade(actor, challenge, content.starter) : null;
      const passed = ref.verdict === "accepted" && starter !== null && starter.verdict !== "accepted";
      result = {
        ...base,
        status: passed ? "passed" : "failed",
        reference: { verdict: ref.verdict, passed: ref.testsPassed, run: ref.testsRun, message: ref.message ?? ref.compileErrors[0]?.message ?? ref.tests.find((t) => !t.passed)?.message ?? null },
        ...(starter ? { starter: { verdict: starter.verdict } } : {}),
        ...(passed ? {} : { message: ref.verdict !== "accepted" ? "Your solution didn't pass the hidden tests." : "The starter code also passes: the tests don't catch an unsolved problem." }),
      };
    } catch (err) {
      result = { ...base, status: "error", message: err instanceof Error ? err.message : "The check couldn't run." };
    }
    await this.repo.setCheck(id, result).catch((err: unknown) => logger.error({ err, id }, "saving draft check failed"));
  }

  async submit(actor: string, id: string) {
    const d = await this.repo.find(id);
    if (d?.authorId !== actor) throw new NotFoundError("No such draft.");
    const issues = this.problemsWith(d.content);
    if (issues.length) throw new BadRequestError(`Fix these first: ${issues.join(" ")}`);
    if (d.check?.status !== "passed" || d.check.contentHash !== hashOf(d.content)) throw new BadRequestError("Run \"Test in my org\" on this version and get it passing before submitting.");
    if (!(await this.repo.transition(id, ["draft", "changes_requested"], "submitted"))) throw new ConflictError("This draft can't be submitted from its current state.");
    return this.get(actor, id);
  }

  async queue(actor: string) {
    await this.admin.require(actor, "reviewer");
    const drafts = await this.repo.byStatus(["submitted"]);
    const handles = await this.handles(drafts.map((d) => d.authorId));
    return drafts.map((d) => ({ id: d.id, title: d.content.title, track: d.content.track, difficulty: d.content.difficulty, author: handles.get(d.authorId) ?? null, updatedAt: d.updatedAt.toISOString() }));
  }

  async decide(actor: string, id: string, action: "approve" | "changes" | "reject", note: string) {
    const standing = await this.admin.require(actor, "reviewer");
    const d = await this.repo.find(id);
    if (!d) throw new NotFoundError("No such draft.");
    if (d.status !== "submitted") throw new ConflictError("Only submitted drafts can be reviewed.");
    if (d.authorId === actor && standing !== "owner") throw new ForbiddenError("You can't review your own problem.");
    const cleanNote = note.trim() || null;
    if (action !== "approve") {
      if (action === "changes" && !cleanNote) throw new BadRequestError("Tell the author what to change.");
      if (!(await this.repo.transition(id, ["submitted"], action === "changes" ? "changes_requested" : "rejected", { reviewedBy: actor, reviewNote: cleanNote }))) throw new ConflictError("Someone else just reviewed this draft.");
      logEvent("problem.reviewed", { id, action, by: actor });
      return this.get(actor, id);
    }

    if (d.check?.status !== "passed" || d.check.contentHash !== hashOf(d.content) || d.check.by === d.authorId) {
      throw new BadRequestError("Run the check in your own org on this version first; it must pass before you approve.");
    }
    const issues = this.problemsWith(d.content);
    if (issues.length) throw new BadRequestError(`Can't publish: ${issues.join(" ")}`);
    let slug = d.slug;
    for (let i = 2; this.catalog.get(slug); i++) slug = `${d.slug}-${i}`;
    const ord = this.catalog.nextCommunityOrder();
    const challenge = { ...this.toChallenge(slug, ord, d.content), authorId: d.authorId };
    const clash = this.catalog.conflict(challenge);
    if (clash) throw new ConflictError(`Can't publish: ${clash}`);
    if (!(await this.repo.publish(id, { slug, ord, authorId: d.authorId, approvedBy: actor, content: d.content }, cleanNote))) throw new ConflictError("Someone else just reviewed this draft.");
    this.catalog.add(challenge);
    logEvent("problem.published", { id, slug, by: actor });
    return this.get(actor, id);
  }

  async listPublished(actor: string) {
    await this.admin.require(actor, "reviewer");
    const rows = await this.repo.published(false);
    const handles = await this.handles(rows.map((r) => r.authorId));
    return rows.map((r) => ({ slug: r.slug, title: r.content.title, track: r.content.track, difficulty: r.content.difficulty, author: handles.get(r.authorId) ?? null, active: r.active, publishedAt: r.publishedAt.toISOString() }));
  }

  /** Admins take a community problem down (or put it back). Solves already made keep counting. */
  async setActive(actor: string, slug: string, active: boolean): Promise<void> {
    await this.admin.require(actor, "admin");
    const row = (await this.repo.published(false)).find((r) => r.slug === slug);
    if (!row) throw new NotFoundError("No such community problem.");
    if (active && !row.active) this.catalog.add({ ...this.toChallenge(row.slug, row.ord, row.content), authorId: row.authorId });
    if (!active) this.catalog.remove(slug);
    await this.repo.setActive(slug, active);
    logEvent("problem.visibility", { slug, active, by: actor });
  }

  countPublishedBy(userId: string): Promise<number> {
    return this.repo.countPublishedBy(userId);
  }
}
