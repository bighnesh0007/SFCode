/**
 * Profiles and the leaderboard. Scores count each problem once, on its first
 * accepted submission, and only on tracks the server grades itself
 * (SCORED_TRACKS) — see ADR-013.
 */
import { randomBytes } from "node:crypto";
import { ConflictError, NotConfiguredError, NotFoundError, ValidationError } from "../../errors/AppError.ts";
import { SCORED_TRACKS, type Track } from "../../domain/challenge.ts";
import { DIFFICULTIES, type Difficulty } from "../../domain/difficulty.ts";
import { achievements, streaks, type Achievement } from "../../domain/achievements.ts";
import { EMPTY_ABOUT, type AboutRecord, type AboutRepository } from "../../repositories/about.repository.ts";
import { PointsService } from "../points/points.service.ts";
import type { ChallengeSubmissionRepository } from "../../repositories/challengeSubmission.repository.ts";
import type { ProfileRecord, ProfileRepository } from "../../repositories/profile.repository.ts";
import type { Clock } from "../../types/ports.ts";
import type { ChallengeCatalog } from "../challenges/catalog.ts";
import type { IdentityLookup } from "../identity/clerkIdentity.ts";

export const HANDLE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,29}$/;
/** Paths a handle could be confused with, or that would read as official. */
const RESERVED = new Set(["admin", "administrator", "sfcode", "support", "moderator", "staff", "system", "me", "settings", "api", "null", "undefined"]);
const LEADERBOARD_TTL_MS = 30_000;
const ACTIVITY_DAYS = 365;

/** Equipped cosmetic style tokens per slot, e.g. { frame: "gold" }. */
export type Cosmetics = Record<string, string>;

export interface CosmeticsSource {
  cosmetics(userIds: string[]): Promise<Map<string, Cosmetics>>;
}

/** Profile data owned by other services; wired after construction (they depend on this one). */
export interface ProfileExtras {
  coins(userId: string): Promise<number>;
  contestHistory(userId: string): Promise<ContestResult[]>;
  roadmapProgress(userId: string): Promise<{ title: string; done: number; total: number } | null>;
  /** Live community problems this user wrote. */
  contributions(userId: string): Promise<number>;
}

export interface ContestResult {
  slug: string;
  title: string;
  endsAt: string;
  rank: number;
  entrants: number;
  score: number;
}

export interface ProfileStats {
  streak: number;
  longestStreak: number;
  coins: number | null;
  contests: number;
  bestPlacement: number | null;
  activeDays: number;
  /** Community problems they wrote that are live. */
  contributions: number;
}

export interface ProfileView {
  cosmetics: Cosmetics;
  about: AboutRecord;
  stats: ProfileStats;
  achievements: Achievement[];
  contests: ContestResult[];
  roadmap: { title: string; done: number; total: number } | null;
  handle: string;
  displayName: string;
  imageUrl: string | null;
  joined: string;
  score: number;
  solved: number;
  rank: number | null;
  byTrack: { track: Track; solved: number; total: number }[];
  byDifficulty: { difficulty: Difficulty; solved: number; total: number }[];
  activity: { day: string; count: number }[];
  recent: { slug: string; title: string; track: Track; difficulty: Difficulty; at: string }[];
}

export interface LeaderboardRow {
  cosmetics: Cosmetics;
  rank: number;
  handle: string;
  displayName: string;
  imageUrl: string | null;
  score: number;
  solved: number;
}

export type LeaderboardWindow = "all" | "30d";

export class CommunityService {
  private cached = new Map<LeaderboardWindow, { at: number; rows: LeaderboardRow[] }>();
  /** Set after construction: the store depends on contests, which depend on this. */
  private cosmeticsSource: CosmeticsSource | undefined;

  setCosmeticsSource(source: CosmeticsSource): void {
    this.cosmeticsSource = source;
  }

  private extras: ProfileExtras | undefined;
  setExtras(extras: ProfileExtras): void {
    this.extras = extras;
  }

  async updateAbout(userId: string, about: AboutRecord): Promise<ProfileView> {
    if (!this.about) throw new NotConfiguredError("Profile details");
    const p = await this.ensureProfile(userId);
    // Empty links are stored as null so the profile shows nothing rather than a dead link.
    await this.about.save(userId, { ...about, bio: about.bio.trim(), company: about.company.trim(), location: about.location.trim(), trailheadUrl: about.trailheadUrl || null, linkedinUrl: about.linkedinUrl || null, githubUrl: about.githubUrl || null, certifications: [...new Set(about.certifications)] });
    return this.view(p);
  }

  private async cosmeticsOf(userIds: string[]): Promise<Map<string, Cosmetics>> {
    return this.cosmeticsSource ? this.cosmeticsSource.cosmetics(userIds) : new Map();
  }

  constructor(
    private readonly catalog: ChallengeCatalog,
    private readonly submissions: ChallengeSubmissionRepository,
    private readonly profiles: ProfileRepository,
    private readonly identity: IdentityLookup | undefined,
    private readonly clock: Clock,
    private readonly about?: AboutRepository,
    private readonly points: PointsService = new PointsService(undefined, undefined),
  ) {}

  /** The caller's profile, created on first use from their public Clerk identity. */
  async ensureProfile(userId: string): Promise<ProfileRecord> {
    const existing = await this.profiles.findByUser(userId);
    if (existing) return existing;
    const id = (await this.identity?.lookup(userId)) ?? { username: null, displayName: null, imageUrl: null };
    const base = id.username && HANDLE.test(id.username) && !RESERVED.has(id.username.toLowerCase()) ? id.username : null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const handle = attempt === 0 && base ? base : `${base ?? "learner"}-${randomBytes(3).toString("hex")}`;
      const created = await this.profiles.create({ userId, handle, displayName: id.displayName ?? handle, imageUrl: id.imageUrl });
      if (created) break;
    }
    const profile = await this.profiles.findByUser(userId);
    if (!profile) throw new Error("could not create a profile");
    return profile;
  }

  async updateProfile(userId: string, changes: { handle?: string; displayName?: string }): Promise<ProfileView> {
    await this.ensureProfile(userId);
    if (changes.handle !== undefined && (!HANDLE.test(changes.handle) || RESERVED.has(changes.handle.toLowerCase()))) {
      throw new ValidationError("Handles are 3–30 letters, digits, - or _, starting with a letter or digit, and some names are reserved.");
    }
    if (changes.displayName?.trim().length === 0) throw new ValidationError("Display name can't be empty.");
    const ok = await this.profiles.update(userId, { ...changes, ...(changes.displayName ? { displayName: changes.displayName.trim() } : {}) });
    if (!ok) throw new ConflictError("That handle is taken.");
    this.cached.clear();
    const p = await this.profiles.findByUser(userId);
    if (!p) throw new NotFoundError("Profile not found.");
    return this.view(p);
  }

  async me(userId: string): Promise<ProfileView> {
    return this.view(await this.ensureProfile(userId));
  }

  async byHandle(handle: string): Promise<ProfileView> {
    const p = await this.profiles.findByHandle(handle);
    if (!p) throw new NotFoundError("No learner with that handle.");
    return this.view(p);
  }

  async leaderboard(window: LeaderboardWindow, limit = 100): Promise<LeaderboardRow[]> {
    const now = this.clock.nowMs();
    const hit = this.cached.get(window);
    if (hit !== undefined && now - hit.at < LEADERBOARD_TTL_MS) return hit.rows.slice(0, limit);

    const since = window === "30d" ? new Date(now - 30 * 86_400_000) : undefined;
    const table = await this.points.table();
    const totals = new Map<string, { score: number; solved: number; last: number }>();
    for (const s of await this.submissions.firstSolves(since)) {
      const c = this.catalog.get(s.slug);
      if (!c || !SCORED_TRACKS.includes(c.track)) continue;
      const t = totals.get(s.userId) ?? { score: 0, solved: 0, last: 0 };
      t.score += table.points(c.track, c.difficulty);
      t.solved += 1;
      t.last = Math.max(t.last, s.at.getTime());
      totals.set(s.userId, t);
    }
    const profiles = new Map((await this.profiles.findByUsers([...totals.keys()])).map((p) => [p.userId, p]));
    // Higher score first; on a tie, whoever reached it earlier.
    const ordered = [...totals]
      .flatMap(([userId, t]) => {
        const p = profiles.get(userId);
        return p ? [{ p, t }] : [];
      })
      .sort((a, b) => b.t.score - a.t.score || a.t.last - b.t.last);
    const looks = await this.cosmeticsOf(ordered.map(({ p }) => p.userId));
    const rows = ordered.map(({ p, t }, i) => ({ rank: i + 1, handle: p.handle, displayName: p.displayName, imageUrl: p.imageUrl, score: t.score, solved: t.solved, cosmetics: looks.get(p.userId) ?? {} }));
    this.cached.set(window, { at: now, rows });
    return rows.slice(0, limit);
  }

  private async view(p: ProfileRecord): Promise<ProfileView> {
    const scored = this.catalog.all().filter((c) => SCORED_TRACKS.includes(c.track));
    const mine = await this.submissions.firstSolves(undefined, p.userId);
    const solvedSlugs = new Set(mine.map((s) => s.slug));
    const solvedScored = scored.filter((c) => solvedSlugs.has(c.slug));
    const board = await this.leaderboard("all", Number.MAX_SAFE_INTEGER);
    const since = new Date(this.clock.nowMs() - ACTIVITY_DAYS * 86_400_000);
    const activity = await this.submissions.dailyActivity(p.userId, since);
    const streak = streaks(activity.filter((d) => d.count > 0).map((d) => d.day), this.clock.now().toISOString().slice(0, 10));
    const [coins, contests, roadmap, about, contributions] = await Promise.all([
      this.extras ? this.extras.coins(p.userId) : Promise.resolve(null),
      this.extras ? this.extras.contestHistory(p.userId) : Promise.resolve([]),
      this.extras ? this.extras.roadmapProgress(p.userId) : Promise.resolve(null),
      this.about ? this.about.get(p.userId) : Promise.resolve(null),
      this.extras ? this.extras.contributions(p.userId) : Promise.resolve(0),
    ]);
    const bestPlacement = contests.length ? Math.min(...contests.map((c) => c.rank)) : null;
    const table = await this.points.table();
    const score = solvedScored.reduce((sum, c) => sum + table.points(c.track, c.difficulty), 0);

    return {
      about: about ?? EMPTY_ABOUT,
      stats: { streak: streak.current, longestStreak: streak.longest, coins, contests: contests.length, bestPlacement, activeDays: activity.filter((d) => d.count > 0).length, contributions },
      achievements: achievements({
        solved: solvedScored.map((c) => ({ slug: c.slug, track: c.track, difficulty: c.difficulty, category: c.category })),
        score,
        longestStreak: streak.longest,
        contestsEntered: contests.length,
        bestPlacement,
        roadmapPct: roadmap && roadmap.total > 0 ? (100 * roadmap.done) / roadmap.total : null,
        contributions,
      }),
      contests: contests.slice(0, 10),
      roadmap,
      cosmetics: (await this.cosmeticsOf([p.userId])).get(p.userId) ?? {},
      handle: p.handle,
      displayName: p.displayName,
      imageUrl: p.imageUrl,
      joined: p.createdAt.toISOString(),
      score,
      solved: solvedScored.length,
      rank: board.find((r) => r.handle === p.handle)?.rank ?? null,
      byTrack: SCORED_TRACKS.map((track) => ({
        track,
        solved: solvedScored.filter((c) => c.track === track).length,
        total: scored.filter((c) => c.track === track).length,
      })),
      byDifficulty: DIFFICULTIES.map((d) => ({
        difficulty: d.id,
        solved: solvedScored.filter((c) => c.difficulty === d.id).length,
        total: scored.filter((c) => c.difficulty === d.id).length,
      })),
      activity,
      // Same rule as the score: only server-verified solves are shown as solved.
      recent: mine
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .flatMap((s) => {
          const c = this.catalog.get(s.slug);
          return c && SCORED_TRACKS.includes(c.track) ? [{ slug: c.slug, title: c.title, track: c.track, difficulty: c.difficulty, at: s.at.toISOString() }] : [];
        })
        .slice(0, 10),
    };
  }
}
