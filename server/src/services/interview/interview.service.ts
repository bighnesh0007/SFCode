/**
 * Interview mode: a random set of problems against the clock, then a scorecard
 * built from the learner's real graded submissions in that window. The session
 * itself lives in the browser; nothing new is stored.
 */
import { ValidationError } from "../../errors/AppError.ts";
import type { Track } from "../../domain/challenge.ts";
import { interviewVerdict, outcomeFor, type ProblemOutcome } from "../../domain/interview.ts";
import type { ChallengeSubmissionRepository } from "../../repositories/challengeSubmission.repository.ts";
import type { ChallengeCatalog } from "../challenges/catalog.ts";
import type { PointsService } from "../points/points.service.ts";

/** Tracks graded on demand. Flow needs building in an org, which doesn't fit a timed round. */
export const INTERVIEW_TRACKS: readonly Track[] = ["apex", "soql", "debug", "lwc"];

export interface InterviewProblem {
  slug: string;
  title: string;
  track: Track;
  difficulty: string;
}

export class InterviewService {
  constructor(
    private readonly catalog: ChallengeCatalog,
    private readonly submissions: ChallengeSubmissionRepository,
    private readonly points: PointsService,
    private readonly random: () => number = Math.random,
  ) {}

  private shuffle<T>(items: T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [a[i], a[j]] = [a[j] as T, a[i] as T];
    }
    return a;
  }

  /** Picks `count` problems from the chosen tracks, preferring ones the learner hasn't solved, with at most one Hard. */
  async start(userId: string, count: number, tracks: Track[]): Promise<InterviewProblem[]> {
    const allowed = tracks.filter((t) => INTERVIEW_TRACKS.includes(t));
    if (allowed.length === 0) throw new ValidationError("Pick at least one track.");
    const progress = await this.submissions.progress(userId);
    const pool = this.catalog.all().filter((c) => allowed.includes(c.track));
    if (pool.length < count) throw new ValidationError(`Those tracks have only ${pool.length} problems; pick fewer or add tracks.`);
    const unsolved = this.shuffle(pool.filter((c) => progress.get(c.slug) !== "solved"));
    const solved = this.shuffle(pool.filter((c) => progress.get(c.slug) === "solved"));
    const picked: typeof pool = [];
    for (const c of [...unsolved, ...solved]) {
      if (picked.length === count) break;
      if (c.difficulty === "Hard" && picked.some((p) => p.difficulty === "Hard")) continue;
      picked.push(c);
    }
    // If the one-Hard rule left us short, fill from whatever remains.
    for (const c of [...unsolved, ...solved]) {
      if (picked.length === count) break;
      if (!picked.includes(c)) picked.push(c);
    }
    const order = { Easy: 0, Medium: 1, Hard: 2 } as Record<string, number>;
    return picked
      .sort((a, b) => (order[a.difficulty] ?? 0) - (order[b.difficulty] ?? 0))
      .map((c) => ({ slug: c.slug, title: c.title, track: c.track, difficulty: c.difficulty }));
  }

  async score(userId: string, slugs: string[], startedAt: Date, endsAt: Date) {
    if (endsAt <= startedAt) throw new ValidationError("The interview must end after it starts.");
    const table = await this.points.table();
    const problems = await Promise.all(
      slugs.map(async (slug) => {
        const c = this.catalog.get(slug);
        if (!c) throw new ValidationError(`Unknown problem ${slug}.`);
        const outcome: ProblemOutcome = outcomeFor(await this.submissions.listForProblem(userId, slug, 100), startedAt, endsAt);
        return { slug, title: c.title, track: c.track, difficulty: c.difficulty, points: table.points(c.track, c.difficulty), ...outcome };
      }),
    );
    const solved = problems.filter((p) => p.solved).length;
    return {
      problems,
      solved,
      total: problems.length,
      score: problems.reduce((n, p) => n + (p.solved ? p.points : 0), 0),
      maxScore: problems.reduce((n, p) => n + p.points, 0),
      wrongAttempts: problems.reduce((n, p) => n + p.wrongAttempts, 0),
      verdict: interviewVerdict(solved, problems.length),
    };
  }
}
