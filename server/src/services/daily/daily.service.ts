/**
 * Daily Challenge: one scored problem per UTC day, the same for everyone.
 * Solving it on the day earns DAILY_BONUS coins on top of normal points
 * (re-solving an old problem still counts: the point is to show up daily).
 */
import { createHash } from "node:crypto";
import { streaks } from "../../domain/achievements.ts";
import { SCORED_TRACKS } from "../../domain/challenge.ts";
import type { DailyRepository } from "../../repositories/daily.repository.ts";
import type { Clock } from "../../types/ports.ts";
import type { ChallengeCatalog } from "../challenges/catalog.ts";

export const DAILY_BONUS = 15;

export interface DailyView {
  day: string;
  problem: { slug: string; title: string; track: string; difficulty: string };
  bonus: number;
  /** null when signed out. */
  solvedToday: boolean | null;
  streak: number | null;
  wins: number | null;
  /** Seconds until the next UTC midnight. */
  resetsIn: number;
}

export class DailyService {
  constructor(
    private readonly repo: DailyRepository,
    private readonly catalog: ChallengeCatalog,
    private readonly clock: Clock,
  ) {}

  /** Deterministic, evenly spread pick: hash the date over the sorted scored problems. */
  private candidate(day: string): string {
    const pool = this.catalog.all().filter((c) => SCORED_TRACKS.includes(c.track)).map((c) => c.slug).sort();
    const n = createHash("sha256").update(`sfcode-daily:${day}`).digest().readUInt32BE(0);
    return pool[n % pool.length] ?? "";
  }

  today(): string {
    return this.clock.now().toISOString().slice(0, 10);
  }

  async view(userId: string | null): Promise<DailyView> {
    const day = this.today();
    let slug = await this.repo.getOrCreate(day, this.candidate(day));
    // A pick whose problem was since removed falls back to today's candidate.
    if (!this.catalog.get(slug)) slug = this.candidate(day);
    const c = this.catalog.get(slug);
    const wins = userId ? await this.repo.wins(userId) : null;
    const nextMidnight = Date.parse(`${day}T00:00:00Z`) + 86_400_000;
    return {
      day,
      problem: { slug, title: c?.title ?? slug, track: c?.track ?? "apex", difficulty: c?.difficulty ?? "Easy" },
      bonus: DAILY_BONUS,
      solvedToday: wins ? wins.includes(day) : null,
      streak: wins ? streaks(wins, day).current : null,
      wins: wins ? wins.length : null,
      resetsIn: Math.max(0, Math.round((nextMidnight - this.clock.nowMs()) / 1000)),
    };
  }

  /** Bonus coins earned from daily wins. */
  async coins(userId: string): Promise<number> {
    return (await this.repo.wins(userId)).length * DAILY_BONUS;
  }
}
