/**
 * Onboarding answers and roadmap progress. Progress is derived from real
 * solves (never self-reported) except for lesson-only nodes, which the user
 * marks as read. A node the user's chosen level already covers is "assumed":
 * it counts as met for prerequisites but stays open to do.
 */
import { BadRequestError, NotFoundError } from "../../errors/AppError.ts";
import { ASSUMED_BELOW, quizPassed, type Level, type Roadmap, type RoadmapNode } from "../../domain/roadmap.ts";
import type { ChallengeSubmissionRepository } from "../../repositories/challengeSubmission.repository.ts";
import type { OnboardingRecord, OnboardingRepository } from "../../repositories/onboarding.repository.ts";
import type { ChallengeCatalog } from "../challenges/catalog.ts";

export type NodeState = "done" | "assumed" | "in_progress" | "available" | "locked";

export interface OnboardingAnswers {
  role: string;
  level: Level;
  goal: string;
  hours: string;
}

export interface QuizResult {
  correct: number;
  total: number;
  passed: boolean;
  results: { correct: boolean; answer: number; why: string }[];
  roadmap: RoadmapView;
}

export interface RoadmapNodeView extends Omit<RoadmapNode, "problems" | "quiz"> {
  /** Questions only; answers and explanations come back after submitting. */
  quiz?: { q: string; options: string[]; image?: string; imageAlt?: string }[];
  depth: number;
  state: NodeState;
  /** Attempted a problem here without solving it: suggest the prerequisites/lesson. */
  struggling: boolean;
  read: boolean;
  /** Completion is by marking read: lesson-only nodes (every problem, LWC included, is now graded on the server). */
  completeByReading: boolean;
  /** Completion is by passing the step quiz. */
  completeByQuiz: boolean;
  problems: { slug: string; title: string; track: string; difficulty: string; status: "solved" | "attempted" | "todo" }[];
}

export interface RoadmapView {
  id: string;
  title: string;
  description: string;
  level: Level;
  personalised: boolean;
  nodes: RoadmapNodeView[];
  next: string | null;
  done: number;
  total: number;
}

export class RoadmapService {
  constructor(
    private readonly roadmaps: Map<string, Roadmap>,
    private readonly catalog: ChallengeCatalog,
    private readonly repo: OnboardingRepository,
    private readonly submissions: ChallengeSubmissionRepository,
  ) {}

  list(): { id: string; title: string; description: string; nodes: number }[] {
    return [...this.roadmaps.values()].sort((a, b) => a.order - b.order).map((r) => ({ id: r.id, title: r.title, description: r.description, nodes: r.nodes.length }));
  }

  onboarding(userId: string): Promise<OnboardingRecord | null> {
    return this.repo.get(userId);
  }

  /** Admins, consultants and Admin-cert seekers get the Admin path; everyone else the Developer path. */
  private pickRoadmap(answers: OnboardingAnswers): string {
    const wantsAdmin = answers.role === "admin" || answers.role === "consultant" || answers.goal === "admin-cert";
    if (wantsAdmin && this.roadmaps.has("admin")) return "admin";
    return this.roadmaps.has("developer") ? "developer" : ([...this.roadmaps.keys()][0] ?? "developer");
  }

  async saveOnboarding(userId: string, answers: OnboardingAnswers): Promise<OnboardingRecord> {
    return this.repo.save({ userId, ...answers, roadmapId: this.pickRoadmap(answers) });
  }

  private roadmap(id: string): Roadmap {
    const r = this.roadmaps.get(id);
    if (!r) throw new NotFoundError("No such roadmap.");
    return r;
  }

  async view(roadmapId: string, userId: string | null): Promise<RoadmapView> {
    const r = this.roadmap(roadmapId);
    const ob = userId ? await this.repo.get(userId) : null;
    const progress = userId ? await this.submissions.progress(userId) : new Map<string, "solved" | "attempted">();
    const level: Level = (ob?.level as Level | undefined) ?? "new";
    const read = new Set(ob?.readNodes ?? []);

    const base = new Map<string, Omit<RoadmapNodeView, "state"> & { selfDone: boolean; touched: boolean }>();
    for (const n of r.nodes) {
      const problems = n.problems.map((slug) => {
        const c = this.catalog.get(slug);
        return { slug, title: c?.title ?? slug, track: c?.track ?? "apex", difficulty: c?.difficulty ?? "Easy", status: progress.get(slug) === "solved" ? "solved" as const : progress.get(slug) === "attempted" ? "attempted" as const : "todo" as const };
      });
      const graded = problems;
      const completeByQuiz = graded.length === 0 && n.quiz !== undefined;
      const completeByReading = graded.length === 0 && !completeByQuiz;
      const selfDone = graded.length === 0 ? read.has(n.id) : graded.every((p) => p.status === "solved");
      const { quiz, ...rest } = n;
      base.set(n.id, {
        ...rest,
        ...(quiz ? { quiz: quiz.map(({ q, options, image, imageAlt }) => ({ q, options, ...(image ? { image } : {}), ...(imageAlt ? { imageAlt } : {}) })) } : {}),
        completeByQuiz,
        problems,
        depth: r.depth[n.id] ?? 0,
        read: read.has(n.id),
        completeByReading,
        struggling: !selfDone && problems.some((p) => p.status === "attempted"),
        selfDone,
        touched: problems.some((p) => p.status !== "todo") || read.has(n.id),
      });
    }

    const assumedMax = ASSUMED_BELOW[level];
    const met = (id: string): boolean => {
      const node = r.nodes.find((n) => n.id === id);
      return base.get(id)?.selfDone === true || (node?.level ?? 99) <= assumedMax;
    };
    const nodes: RoadmapNodeView[] = r.nodes.flatMap((n) => {
      const entry = base.get(n.id);
      if (!entry) return [];
      const { selfDone, touched, ...b } = entry;
      const state: NodeState = selfDone
        ? "done"
        : n.level <= assumedMax
          ? "assumed"
          : !n.requires.every(met)
            ? "locked"
            : touched
              ? "in_progress"
              : "available";
      return [{ ...b, state }];
    });

    const ordered = [...nodes].sort((a, b) => a.depth - b.depth || a.col - b.col);
    // Optional steps are offered but never pressed on the learner: not "next", not in progress totals.
    const main = ordered.filter((n) => !n.optional);
    const next = (main.find((n) => n.state === "in_progress") ?? main.find((n) => n.state === "available"))?.id ?? null;
    const counted = nodes.filter((n) => n.state !== "assumed" && !n.optional);
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      level,
      personalised: ob !== null,
      nodes,
      next,
      done: counted.filter((n) => n.state === "done").length,
      total: counted.length,
    };
  }

  async setRead(userId: string, roadmapId: string, nodeId: string, read: boolean): Promise<RoadmapView> {
    const r = this.roadmap(roadmapId);
    const node = r.nodes.find((n) => n.id === nodeId);
    if (!node) throw new NotFoundError("No such roadmap step.");
    // Quiz steps complete only by passing; otherwise the quiz is decoration.
    if (read && node.quiz) throw new BadRequestError("Pass this step's quiz to complete it.");
    if ((await this.repo.setRead(userId, nodeId, read)) === null) throw new BadRequestError("Finish the welcome quiz first.");
    return this.view(roadmapId, userId);
  }

  async submitQuiz(userId: string, roadmapId: string, nodeId: string, answers: number[]): Promise<QuizResult> {
    const node = this.roadmap(roadmapId).nodes.find((n) => n.id === nodeId);
    if (!node?.quiz) throw new NotFoundError("This step has no quiz.");
    if (answers.length !== node.quiz.length) throw new BadRequestError(`Answer all ${node.quiz.length} questions.`);
    const results = node.quiz.map((q, i) => ({ correct: answers[i] === q.answer, answer: q.answer, why: q.why }));
    const correct = results.filter((r) => r.correct).length;
    const passed = quizPassed(correct, results.length);
    if (passed && (await this.repo.setRead(userId, nodeId, true)) === null) throw new BadRequestError("Finish the welcome quiz first.");
    return { correct, total: results.length, passed, results, roadmap: await this.view(roadmapId, userId) };
  }
}
