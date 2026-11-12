/**
 * Onboarding answers and roadmap progress. Progress is derived from real
 * solves (never self-reported) except for lesson-only nodes, which the user
 * marks as read. A node the user's chosen level already covers is "assumed":
 * it counts as met for prerequisites but stays open to do.
 */
import { BadRequestError, NotFoundError } from "../../errors/AppError.ts";
import { ASSUMED_BELOW, type Level, type Roadmap, type RoadmapNode } from "../../domain/roadmap.ts";
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

export interface RoadmapNodeView extends Omit<RoadmapNode, "problems"> {
  depth: number;
  state: NodeState;
  /** Attempted a problem here without solving it: suggest the prerequisites/lesson. */
  struggling: boolean;
  read: boolean;
  /** Completion is by marking read: lesson-only nodes, and LWC (graded in the browser, not stored). */
  completeByReading: boolean;
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
    return [...this.roadmaps.values()].map((r) => ({ id: r.id, title: r.title, description: r.description, nodes: r.nodes.length }));
  }

  onboarding(userId: string): Promise<OnboardingRecord | null> {
    return this.repo.get(userId);
  }

  /** Phase 1 has one roadmap; other roles get it too until theirs exist. */
  private pickRoadmap(_answers: OnboardingAnswers): string {
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
      const graded = problems.filter((p) => p.track !== "lwc");
      const completeByReading = graded.length === 0;
      const selfDone = completeByReading ? read.has(n.id) : graded.every((p) => p.status === "solved");
      base.set(n.id, {
        ...n,
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
    const next = (ordered.find((n) => n.state === "in_progress") ?? ordered.find((n) => n.state === "available"))?.id ?? null;
    const counted = nodes.filter((n) => n.state !== "assumed");
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
    if (!r.nodes.some((n) => n.id === nodeId)) throw new NotFoundError("No such roadmap step.");
    if ((await this.repo.setRead(userId, nodeId, read)) === null) throw new BadRequestError("Finish the welcome quiz first.");
    return this.view(roadmapId, userId);
  }
}
