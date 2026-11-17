/**
 * Creates the Weekly and Biweekly contests ahead of time. Runs hourly; every
 * step is idempotent (the slug is unique), so restarts and overlapping runs
 * are harmless. Admins can still edit or delete them: a deleted auto contest
 * is remembered in settings and not recreated, and the whole feature can be
 * switched off there.
 */
import { isAutoSlug, pickProblems, upcoming } from "../../domain/autoContest.ts";
import { logEvent } from "../../lib/logger.ts";
import type { ContestRepository } from "../../repositories/contest.repository.ts";
import type { SettingsRepository } from "../../repositories/settings.repository.ts";
import type { Clock } from "../../types/ports.ts";
import type { ChallengeCatalog } from "../challenges/catalog.ts";

export const SETTINGS_KEY = "auto-contests";
const HORIZON_MS = 7 * 24 * 3600_000;
const RECENT_CONTESTS = 8;
// Flow problems are built by hand in Flow Builder: too slow for a 90-minute round.
const TRACKS = new Set(["apex", "soql", "debug", "lwc"]);

interface AutoSettings {
  enabled: boolean;
  skipped: string[];
}

export class AutoContestService {
  constructor(
    private readonly repo: ContestRepository,
    private readonly catalog: ChallengeCatalog,
    private readonly settings: SettingsRepository,
    private readonly clock: Clock,
  ) {}

  async state(): Promise<AutoSettings> {
    const raw = (await this.settings.get(SETTINGS_KEY)) as Partial<AutoSettings> | null;
    return { enabled: raw?.enabled !== false, skipped: Array.isArray(raw?.skipped) ? raw.skipped.filter((s): s is string => typeof s === "string") : [] };
  }

  async setEnabled(enabled: boolean, by: string): Promise<AutoSettings> {
    const s = { ...(await this.state()), enabled };
    await this.settings.set(SETTINGS_KEY, s, by);
    return s;
  }

  /** Called when an admin deletes a contest, so the scheduler doesn't bring it back. */
  async remember(slug: string, by: string): Promise<void> {
    if (!isAutoSlug(slug)) return;
    const s = await this.state();
    if (!s.skipped.includes(slug)) await this.settings.set(SETTINGS_KEY, { ...s, skipped: [...s.skipped, slug].slice(-100) }, by);
  }

  /** Creates any auto contest starting within the next 7 days. Returns the slugs it created. */
  async ensureUpcoming(): Promise<string[]> {
    const s = await this.state();
    if (!s.enabled) return [];
    const existing = await this.repo.list();
    const have = new Set(existing.map((c) => c.slug));
    const recent = existing
      .slice()
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
      .slice(0, RECENT_CONTESTS)
      .flatMap((c) => c.problems.map((p) => p.slug));
    const used = new Set(recent);
    const candidates = this.catalog
      .all()
      .filter((c) => TRACKS.has(c.track) && !c.authorId)
      .map((c) => ({ slug: c.slug, track: c.track, difficulty: c.difficulty }));

    const created: string[] = [];
    for (const o of upcoming(this.clock.nowMs(), HORIZON_MS)) {
      if (have.has(o.slug) || s.skipped.includes(o.slug)) continue;
      const problems = pickProblems(o.slug, candidates, used);
      if (problems.length === 0) continue;
      const c = await this.repo.create({ slug: o.slug, title: o.title, startsAt: o.startsAt, endsAt: o.endsAt, createdBy: "system", problems });
      if (c) {
        created.push(o.slug);
        for (const p of problems) used.add(p.slug);
        logEvent("contest.auto_created", { slug: o.slug, problems: problems.map((p) => p.slug).join(",") });
      }
    }
    return created;
  }
}
