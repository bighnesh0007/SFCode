/**
 * The points table: points per (track, difficulty), editable by admins.
 *
 * Coins follow a cutover so changing the scale never takes coins away:
 * solves before `cutover` keep their old value (Easy 10 / Medium 20 /
 * Hard 40); solves after earn `points × coinsPerPoint`. The leaderboard
 * always uses the current table for everyone.
 */
import { z } from "zod";
import { TRACKS, type Track } from "../../domain/challenge.ts";
import { DIFFICULTY_IDS, pointsFor as legacyPoints, type Difficulty } from "../../domain/difficulty.ts";
import { logEvent } from "../../lib/logger.ts";
import type { SettingsRepository } from "../../repositories/settings.repository.ts";
import type { AdminService } from "../admin/admin.service.ts";

const cell = z.number().int().min(0).max(100);
const row = z.strictObject(Object.fromEntries(DIFFICULTY_IDS.map((d) => [d, cell])) as Record<Difficulty, typeof cell>);
export const pointsMatrixSchema = z.strictObject(Object.fromEntries(TRACKS.map((t) => [t, row])) as Record<Track, typeof row>);
const settingsSchema = z.object({ matrix: pointsMatrixSchema, coinsPerPoint: z.number().int().min(0).max(100), cutover: z.iso.datetime() });

export type PointsMatrix = z.infer<typeof pointsMatrixSchema>;
export type PointsSettings = z.infer<typeof settingsSchema>;

/** Used when the database has no row (fresh test databases, local mode). */
export const DEFAULT_POINTS: PointsSettings = {
  matrix: {
    lwc: { Easy: 4, Medium: 8, Hard: 12 },
    apex: { Easy: 3, Medium: 6, Hard: 9 },
    debug: { Easy: 2, Medium: 6, Hard: 9 },
    flow: { Easy: 2, Medium: 4, Hard: 6 },
    soql: { Easy: 1, Medium: 2, Hard: 3 },
  },
  coinsPerPoint: 3,
  cutover: "1970-01-01T00:00:00Z",
};

/** A snapshot with sync lookups, so loops over many solves don't await per row. */
export class PointsTable {
  private readonly cutoverMs: number;
  constructor(readonly settings: PointsSettings) {
    this.cutoverMs = Date.parse(settings.cutover);
  }
  points(track: Track, difficulty: Difficulty): number {
    return this.settings.matrix[track][difficulty];
  }
  coins(track: Track, difficulty: Difficulty, solvedAt: Date): number {
    return solvedAt.getTime() < this.cutoverMs ? legacyPoints(difficulty) : this.points(track, difficulty) * this.settings.coinsPerPoint;
  }
}

export class PointsService {
  private cache: PointsTable | null = null;

  constructor(
    private readonly repo: SettingsRepository | undefined,
    private readonly admin: AdminService | undefined,
  ) {}

  async table(): Promise<PointsTable> {
    if (this.cache) return this.cache;
    const raw = this.repo ? await this.repo.get("points") : null;
    const parsed = settingsSchema.safeParse(raw);
    this.cache = new PointsTable(parsed.success ? parsed.data : DEFAULT_POINTS);
    return this.cache;
  }

  /** Admins only. The cutover never moves: it was fixed when the table was introduced. */
  async update(actor: string, change: { matrix: PointsMatrix; coinsPerPoint: number }): Promise<PointsSettings> {
    if (!this.admin || !this.repo) throw new Error("points settings need a database");
    await this.admin.require(actor, "admin");
    const current = (await this.table()).settings;
    const next: PointsSettings = { ...current, matrix: change.matrix, coinsPerPoint: change.coinsPerPoint };
    await this.repo.set("points", next, actor);
    this.cache = new PointsTable(next);
    logEvent("admin.points_updated", { by: actor });
    return next;
  }
}
