/**
 * Timed contests. Scoring (ICPC-style): each solved problem earns its points;
 * ties break on penalty = minutes from start to the first accepted submission,
 * plus PENALTY_PER_WRONG for each counted wrong attempt before it. Infra errors
 * ("error" verdicts) never count against anyone.
 *
 * Times are SUBMISSION times, not grading times: a slow org deploy mustn't
 * cost a learner places.
 */
import { randomBytes } from "node:crypto";
import { ConflictError, NotFoundError, ValidationError } from "../../errors/AppError.ts";
import { SCORED_TRACKS } from "../../domain/challenge.ts";
import { replayRatings, type ContestPlacing, type RatingPoint } from "../../domain/rating.ts";
import type { ContestRecord, ContestRepository } from "../../repositories/contest.repository.ts";
import type { ProfileRecord, ProfileRepository } from "../../repositories/profile.repository.ts";
import type { Clock } from "../../types/ports.ts";
import type { AdminService } from "../admin/admin.service.ts";
import type { ChallengeCatalog } from "../challenges/catalog.ts";
import type { CommunityService } from "../community/community.service.ts";

export const PENALTY_PER_WRONG = 5;
const COUNTED_WRONG = new Set(["wrong_answer", "compile_error", "coverage"]);
/** Coins for the top three of a finished contest with a positive score. */
export const PRIZES = [100, 50, 25] as const;
/** After this long past the end, a contest's results are final and cached. */
const SETTLE_MS = 60 * 60_000;

export type ContestPhase = "upcoming" | "live" | "ended";

export interface StandingRow {
  rank: number;
  userId: string;
  handle: string;
  displayName: string;
  imageUrl: string | null;
  score: number;
  penalty: number;
  problems: { slug: string; solved: boolean; wrong: number; minutes: number | null }[];
}

export interface ContestSummary {
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  phase: ContestPhase;
  problemCount: number;
  entrants: number;
}

/** What the public API returns: internal user ids never leave the server. */
export type PublicStandingRow = Omit<StandingRow, "userId">;

export interface ContestView extends ContestSummary {
  joined: boolean;
  canManage: boolean;
  /** Empty until the contest starts (unless you manage contests). */
  problems: { slug: string; title: string; track: string; difficulty: string; points: number }[];
  standings: PublicStandingRow[];
}

function slugify(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  return `${base || "contest"}-${randomBytes(2).toString("hex")}`;
}

export interface RatingRow {
  rank: number;
  handle: string;
  displayName: string;
  imageUrl: string | null;
  rating: number;
  contests: number;
}

export class ContestService {
  constructor(
    private readonly repo: ContestRepository,
    private readonly catalog: ChallengeCatalog,
    private readonly profiles: ProfileRepository,
    private readonly community: CommunityService,
    private readonly admin: AdminService,
    private readonly clock: Clock,
  ) {}

  phase(c: { startsAt: Date; endsAt: Date }): ContestPhase {
    const now = this.clock.nowMs();
    return now < c.startsAt.getTime() ? "upcoming" : now < c.endsAt.getTime() ? "live" : "ended";
  }

  async list(): Promise<ContestSummary[]> {
    return (await this.repo.list()).map((c) => this.summary(c));
  }

  async get(slug: string, viewerId: string | null): Promise<ContestView> {
    const c = await this.repo.findBySlug(slug);
    if (!c) throw new NotFoundError("Contest not found.");
    const standing = viewerId ? await this.admin.standing(viewerId) : null;
    const canManage = standing === "owner" || standing === "admin";
    const phase = this.phase(c);
    return {
      ...this.summary(c),
      joined: viewerId ? await this.repo.isEntrant(c.id, viewerId) : false,
      canManage,
      problems:
        phase === "upcoming" && !canManage
          ? []
          : c.problems.flatMap((p) => {
              const ch = this.catalog.get(p.slug);
              return ch ? [{ slug: ch.slug, title: ch.title, track: ch.track, difficulty: ch.difficulty, points: p.points }] : [];
            }),
      standings: (await this.standings(c)).map(({ userId: _internal, ...row }) => row),
    };
  }

  async create(actor: string, input: { title: string; startsAt: Date; endsAt: Date; problems: { slug: string; points: number }[] }): Promise<ContestView> {
    await this.admin.require(actor, "admin");
    const title = input.title.trim();
    if (title.length < 3 || title.length > 80) throw new ValidationError("The title must be 3–80 characters.");
    const minutes = (input.endsAt.getTime() - input.startsAt.getTime()) / 60_000;
    if (minutes < 30 || minutes > 7 * 24 * 60) throw new ValidationError("A contest runs between 30 minutes and 7 days.");
    if (input.startsAt.getTime() < this.clock.nowMs()) throw new ValidationError("A contest must start in the future.");
    if (input.problems.length < 1 || input.problems.length > 6) throw new ValidationError("Pick 1–6 problems.");
    if (new Set(input.problems.map((p) => p.slug)).size !== input.problems.length) throw new ValidationError("Each problem can appear once.");
    for (const p of input.problems) {
      const ch = this.catalog.get(p.slug);
      // Only problems the server grades itself can decide a contest.
      if (!ch || !SCORED_TRACKS.includes(ch.track)) throw new ValidationError(`${p.slug} isn't a graded problem.`);
      if (!Number.isInteger(p.points) || p.points < 1 || p.points > 1000) throw new ValidationError("Points are whole numbers from 1 to 1000.");
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const c = await this.repo.create({ slug: slugify(title), title, startsAt: input.startsAt, endsAt: input.endsAt, createdBy: actor, problems: input.problems });
      if (c) return this.get(c.slug, actor);
    }
    throw new Error("could not allocate a contest slug");
  }

  async remove(actor: string, slug: string): Promise<void> {
    await this.admin.require(actor, "admin");
    const c = await this.repo.findBySlug(slug);
    if (!c) throw new NotFoundError("Contest not found.");
    if (this.phase(c) !== "upcoming") throw new ConflictError("Only contests that haven't started can be deleted.");
    await this.repo.delete(c.id);
  }

  async join(userId: string, slug: string): Promise<ContestView> {
    const c = await this.repo.findBySlug(slug);
    if (!c) throw new NotFoundError("Contest not found.");
    if (this.phase(c) === "ended") throw new ConflictError("This contest has ended.");
    await this.community.ensureProfile(userId);
    await this.repo.join(c.id, userId);
    return this.get(slug, userId);
  }

  /** Final placements of every ended contest: userId → coins won. */
  /**
   * Final results of a finished contest. Cached once settled (an hour past the
   * end, so in-window submissions have finished grading): results can't
   * change after that, and prizes() / history() would otherwise recompute
   * every past contest on each wallet or profile read.
   */
  private settled = new Map<string, { userId: string; rank: number; score: number }[]>();
  private async finalRows(c: ContestRecord): Promise<{ userId: string; rank: number; score: number }[]> {
    const hit = this.settled.get(c.id);
    if (hit) return hit;
    const rows = (await this.standings(c)).map((r) => ({ userId: r.userId, rank: r.rank, score: r.score }));
    if (this.clock.nowMs() >= c.endsAt.getTime() + SETTLE_MS) this.settled.set(c.id, rows);
    return rows;
  }

  /** The user's contest-rating history (oldest first), replayed from every finished contest. */
  async ratingHistory(userId: string): Promise<RatingPoint[]> {
    const placings: ContestPlacing[] = [];
    for (const c of await this.repo.list()) {
      if (this.phase(c) !== "ended") continue;
      const rows = await this.finalRows(c);
      placings.push({ contestSlug: c.slug, title: c.title, endsAt: c.endsAt.toISOString(), ranks: new Map(rows.map((r) => [r.userId, r.rank])) });
    }
    return replayRatings(placings).get(userId) ?? [];
  }

  private ratingCache: { at: number; rows: RatingRow[] } | null = null;

  /** Everyone's current contest rating, best first. Cached briefly: it replays every finished contest. */
  async ratingBoard(limit = 100): Promise<RatingRow[]> {
    const now = this.clock.nowMs();
    if (this.ratingCache && now - this.ratingCache.at < 60_000) return this.ratingCache.rows.slice(0, limit);
    const placings: ContestPlacing[] = [];
    for (const c of await this.repo.list()) {
      if (this.phase(c) !== "ended") continue;
      const rows = await this.finalRows(c);
      placings.push({ contestSlug: c.slug, title: c.title, endsAt: c.endsAt.toISOString(), ranks: new Map(rows.map((r) => [r.userId, r.rank])) });
    }
    const latest = [...replayRatings(placings)].flatMap(([userId, h]) => {
      const last = h.at(-1);
      return last ? [{ userId, rating: last.rating, contests: h.length }] : [];
    });
    const profiles = new Map((await this.profiles.findByUsers(latest.map((r) => r.userId))).map((p) => [p.userId, p]));
    const rows = latest
      .flatMap((r) => {
        const p = profiles.get(r.userId);
        return p ? [{ handle: p.handle, displayName: p.displayName, imageUrl: p.imageUrl, rating: r.rating, contests: r.contests }] : [];
      })
      .sort((a, b) => b.rating - a.rating || b.contests - a.contests)
      .map((r, i) => ({ rank: i + 1, ...r }));
    this.ratingCache = { at: now, rows };
    return rows.slice(0, limit);
  }

  /** Finished contests the user entered, newest first, with their rank. */
  async history(userId: string): Promise<{ slug: string; title: string; endsAt: string; rank: number; entrants: number; score: number }[]> {
    const out: { slug: string; title: string; endsAt: string; rank: number; entrants: number; score: number }[] = [];
    for (const c of await this.repo.list()) {
      if (this.phase(c) !== "ended") continue;
      const rows = await this.finalRows(c);
      const mine = rows.find((r) => r.userId === userId);
      if (mine) out.push({ slug: c.slug, title: c.title, endsAt: c.endsAt.toISOString(), rank: mine.rank, entrants: rows.length, score: mine.score });
    }
    return out.sort((a, b) => b.endsAt.localeCompare(a.endsAt));
  }

  async prizes(): Promise<Map<string, number>> {
    const won = new Map<string, number>();
    for (const c of await this.repo.list()) {
      if (this.phase(c) !== "ended") continue;
      (await this.finalRows(c)).forEach((row, i) => {
        const prize = PRIZES[i];
        if (prize !== undefined && row.score > 0) won.set(row.userId, (won.get(row.userId) ?? 0) + prize);
      });
    }
    return won;
  }

  async standings(c: ContestRecord): Promise<StandingRow[]> {
    const [entrants, attempts] = await Promise.all([this.repo.entrants(c.id), this.repo.attempts(c.id)]);
    const start = c.startsAt.getTime();
    const end = c.endsAt.getTime();
    const profiles = new Map((await this.profiles.findByUsers(entrants)).map((p): [string, ProfileRecord] => [p.userId, p]));

    const rows = entrants.map((userId) => {
      const problems = c.problems.map((p) => {
        // Only attempts made inside the contest window count.
        const mine = attempts.filter((a) => a.userId === userId && a.slug === p.slug && a.createdAt.getTime() >= start && a.createdAt.getTime() < end);
        const firstAccept = mine.find((a) => a.status === "accepted");
        const before = firstAccept ? mine.filter((a) => a.createdAt < firstAccept.createdAt) : mine;
        const wrong = before.filter((a) => COUNTED_WRONG.has(a.status)).length;
        return {
          slug: p.slug,
          points: p.points,
          solved: firstAccept !== undefined,
          wrong,
          minutes: firstAccept ? Math.floor((firstAccept.createdAt.getTime() - start) / 60_000) : null,
        };
      });
      const solved = problems.filter((p) => p.solved);
      const profile = profiles.get(userId);
      return {
        userId,
        handle: profile?.handle ?? "unknown",
        displayName: profile?.displayName ?? "Unknown",
        imageUrl: profile?.imageUrl ?? null,
        score: solved.reduce((n, p) => n + p.points, 0),
        penalty: solved.reduce((n, p) => n + (p.minutes ?? 0) + PENALTY_PER_WRONG * p.wrong, 0),
        problems: problems.map(({ slug, solved: s, wrong, minutes }) => ({ slug, solved: s, wrong, minutes })),
      };
    });
    rows.sort((a, b) => b.score - a.score || a.penalty - b.penalty || a.handle.localeCompare(b.handle));
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  private summary(c: ContestRecord): ContestSummary {
    return {
      slug: c.slug,
      title: c.title,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
      phase: this.phase(c),
      problemCount: c.problems.length,
      entrants: c.entrants,
    };
  }
}
