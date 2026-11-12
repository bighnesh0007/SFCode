/**
 * Apex Challenge Arena: catalogue reads, submissions and grading.
 *
 * Grading is poll-driven: submit starts a check-only deploy and returns; each
 * time the client asks about a running submission we ask Salesforce (at most
 * once per CHECK_INTERVAL_MS). No in-memory job state, so a server restart
 * mid-grade loses nothing.
 */
import { AppError, ConflictError, NotConfiguredError, NotFoundError, ValidationError } from "../../errors/AppError.ts";
import { logEvent, contextLogger } from "../../lib/logger.ts";
import type { ChallengeSubmissionRepository, SubmissionRecord } from "../../repositories/challengeSubmission.repository.ts";
import type { Challenge, GradeResult, SubmissionStatus } from "../../domain/challenge.ts";
import { DIFFICULTIES } from "../../domain/difficulty.ts";
import type { Clock } from "../../types/ports.ts";
import type { SalesforceConnectionService } from "../salesforce/connection.service.ts";
import { OrgNotConnectedError } from "../salesforce/connection.service.ts";
import type { SalesforceClient } from "../salesforce/salesforceClient.ts";
import type { ChallengeCatalog } from "./catalog.ts";
import { extensionFor } from "./catalog.ts";
import { buildDeployPackage, interpretDeployResult, isDeployDone } from "./grader.ts";

export const CHECK_INTERVAL_MS = 2_000;
/** A deploy still running after this is abandoned (Salesforce queues can stall). */
export const GRADE_TIMEOUT_MS = 15 * 60_000;
export const MAX_FILE_CHARS = 50_000;
/** A submission with no deploy id after this never reached Salesforce. */
export const START_TIMEOUT_MS = 2 * 60_000;

export interface ChallengeSummary {
  slug: string;
  title: string;
  difficulty: string;
  category: string;
  tags: string[];
  progress: "solved" | "attempted" | null;
}

/** Everything a client may see about a problem. Hidden tests and reference are absent by construction. */
export interface ChallengeView {
  slug: string;
  title: string;
  difficulty: string;
  category: string;
  tags: string[];
  statement: string;
  files: { name: string; type: "class" | "trigger"; fileName: string; starter: string }[];
}

export interface SubmissionView {
  id: string;
  problemSlug: string;
  status: SubmissionStatus;
  createdAt: string;
  completedAt: string | null;
  files: Record<string, string>;
  result: GradeResult | null;
}

export interface SubmissionSummary {
  id: string;
  status: SubmissionStatus;
  createdAt: string;
  testsPassed: number | null;
  testsRun: number | null;
}

function errorResult(message: string): GradeResult {
  return { verdict: "error", testsRun: 0, testsPassed: 0, tests: [], compileErrors: [], coverage: [], message };
}

function toView(r: SubmissionRecord): SubmissionView {
  return {
    id: r.id,
    problemSlug: r.problemSlug,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    files: r.files,
    result: r.result,
  };
}

/** What grading needs. Absent when the Salesforce app isn't configured: browsing still works. */
export interface GradingDeps {
  connections: SalesforceConnectionService;
  sf: SalesforceClient;
  apiVersion: string;
}

export class ChallengeService {
  constructor(
    private readonly catalog: ChallengeCatalog,
    private readonly submissions: ChallengeSubmissionRepository,
    private readonly grading: GradingDeps | undefined,
    private readonly clock: Clock,
  ) {}

  private requireGrading(): GradingDeps {
    if (!this.grading) throw new NotConfiguredError("Grading (Salesforce org connection)");
    return this.grading;
  }

  difficulties() {
    return DIFFICULTIES;
  }

  async list(userId: string | null): Promise<ChallengeSummary[]> {
    const progress = userId ? await this.submissions.progress(userId) : new Map<string, "solved" | "attempted">();
    return this.catalog.all().map((c) => ({
      slug: c.slug,
      title: c.title,
      difficulty: c.difficulty,
      category: c.category,
      tags: c.tags,
      progress: progress.get(c.slug) ?? null,
    }));
  }

  get(slug: string): ChallengeView {
    const c = this.require(slug);
    return {
      slug: c.slug,
      title: c.title,
      difficulty: c.difficulty,
      category: c.category,
      tags: c.tags,
      statement: c.statement,
      files: c.files.map((f) => ({ name: f.name, type: f.type, fileName: `${f.name}.${extensionFor(f.type)}`, starter: c.starter[f.name] ?? "" })),
    };
  }

  async submit(userId: string, slug: string, files: Record<string, string>): Promise<SubmissionView> {
    const { connections, sf, apiVersion } = this.requireGrading();
    const challenge = this.require(slug);
    this.checkFiles(challenge, files);

    const connection = await connections.status(userId);
    if (!connection) throw new OrgNotConnectedError();

    const record = await this.submissions.createRunning({ userId, problemSlug: slug, orgId: connection.orgId, files });
    if (!record) throw new ConflictError("You already have a submission being graded. Wait for it to finish.");

    try {
      const zip = buildDeployPackage(challenge, files, apiVersion);
      const deployId = await connections.withOrg(userId, (org) => sf.deployCheckOnly(org.instanceUrl, org.accessToken, zip, challenge.testClass.name));
      await this.submissions.setDeployId(record.id, deployId);
      logEvent("challenge.submitted", { slug, submissionId: record.id });
      return toView({ ...record, deployId });
    } catch (err) {
      const message = err instanceof AppError && err.expose ? err.message : "Could not start grading in your org.";
      await this.submissions.complete(record.id, "error", errorResult(message), this.clock.now());
      if (err instanceof OrgNotConnectedError) throw err;
      contextLogger().warn({ err, submissionId: record.id }, "deploy could not be started");
      return toView({ ...record, status: "error", result: errorResult(message), completedAt: this.clock.now() });
    }
  }

  /** The submission, advanced by one status check if it is still running. */
  async view(userId: string, id: string): Promise<SubmissionView> {
    const record = await this.submissions.findById(id);
    // Someone else's submission is reported as absent, not forbidden: don't confirm it exists.
    if (record?.userId !== userId) throw new NotFoundError("Submission not found.");
    if (record.status !== "running" || !this.grading) return toView(record);
    return toView(await this.advance(record, this.grading));
  }

  async history(userId: string, slug: string): Promise<SubmissionSummary[]> {
    this.require(slug);
    const rows = await this.submissions.listForProblem(userId, slug, 20);
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      testsPassed: r.result?.testsPassed ?? null,
      testsRun: r.result?.testsRun ?? null,
    }));
  }

  private async advance(record: SubmissionRecord, { connections, sf }: GradingDeps): Promise<SubmissionRecord> {
    const now = this.clock.now();
    const finish = async (status: Exclude<SubmissionStatus, "running">, result: GradeResult): Promise<SubmissionRecord> => {
      await this.submissions.complete(record.id, status, result, now);
      // Re-read: a concurrent poll may have completed it first, and its result wins.
      return (await this.submissions.findById(record.id)) ?? record;
    };

    if (now.getTime() - record.createdAt.getTime() > GRADE_TIMEOUT_MS) {
      return finish("error", errorResult("Grading timed out in your org. Try submitting again."));
    }
    if (!record.deployId) {
      // The deploy call takes about a second. Much longer means the process died
      // mid-submit; without this the user stays blocked until GRADE_TIMEOUT_MS.
      if (now.getTime() - record.createdAt.getTime() > START_TIMEOUT_MS) {
        return finish("error", errorResult("Grading never started. Submit again."));
      }
      return record;
    }
    if (record.checkedAt && now.getTime() - record.checkedAt.getTime() < CHECK_INTERVAL_MS) return record;

    const challenge = this.catalog.get(record.problemSlug);
    if (!challenge) return finish("error", errorResult("This problem no longer exists."));

    await this.submissions.markChecked(record.id, now);
    let raw: Record<string, unknown>;
    try {
      raw = await connections.withOrg(record.userId, async (org) => {
        if (org.orgId !== record.orgId) throw new OrgChangedError();
        return sf.checkDeployStatus(org.instanceUrl, org.accessToken, record.deployId ?? "");
      });
    } catch (err) {
      if (err instanceof OrgChangedError || err instanceof OrgNotConnectedError) {
        return finish("error", errorResult("Your connected org changed while this was grading. Submit again."));
      }
      // Transient: report still-running and let the next poll retry.
      contextLogger().warn({ err, submissionId: record.id }, "deploy status check failed");
      return record;
    }

    if (!isDeployDone(raw)) return { ...record, checkedAt: now };
    const result = interpretDeployResult(challenge, raw);
    logEvent("challenge.graded", { slug: challenge.slug, submissionId: record.id, verdict: result.verdict });
    return finish(result.verdict, result);
  }

  private require(slug: string): Challenge {
    const c = this.catalog.get(slug);
    if (!c) throw new NotFoundError("Challenge not found.");
    return c;
  }

  /** Exactly the problem's files, each within size. */
  private checkFiles(challenge: Challenge, files: Record<string, string>): void {
    const expected = challenge.files.map((f) => f.name).sort();
    const got = Object.keys(files).sort();
    if (expected.length !== got.length || expected.some((n, i) => n !== got[i])) {
      throw new ValidationError(`Submit exactly these files: ${expected.join(", ")}.`);
    }
    for (const [name, src] of Object.entries(files)) {
      if (src.length > MAX_FILE_CHARS) throw new ValidationError(`${name} is longer than ${MAX_FILE_CHARS} characters.`);
    }
  }
}

class OrgChangedError extends Error {}
