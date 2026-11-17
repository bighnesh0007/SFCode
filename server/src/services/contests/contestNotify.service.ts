/**
 * Contest notifications, run every few minutes:
 * - an hour before a contest starts: a bell notice to everyone who joined, and
 *   an email to everyone who opted in to contest reminders;
 * - once a contest's results settle: a bell notice to each entrant with their
 *   placing and rating change.
 *
 * Each contest is announced at most once per kind. The slugs already handled
 * live in app settings, marked before sending: a crash mid-run loses a few
 * notices rather than sending everyone a duplicate on restart.
 */
import { logger } from "../../lib/logger.ts";
import type { ContestRepository } from "../../repositories/contest.repository.ts";
import type { SettingsRepository } from "../../repositories/settings.repository.ts";
import type { Clock } from "../../types/ports.ts";
import type { ContestRatingChange } from "./contest.service.ts";

const SETTINGS_KEY = "contest-notifications";
export const REMIND_BEFORE_MS = 60 * 60_000;
/** Results older than this are never announced (e.g. on the first run after deploy). */
const RESULTS_WINDOW_MS = 48 * 60 * 60_000;
const KEEP = 200;

interface State {
  reminded: string[];
  resulted: string[];
}

export interface ContestNotifyDeps {
  repo: Pick<ContestRepository, "list" | "entrants">;
  contests: {
    settledResults(slug: string): Promise<{ userId: string; rank: number; score: number }[] | null>;
    ratingChanges(slug: string): Promise<Map<string, ContestRatingChange>>;
  };
  notify(userId: string, kind: "contest", data: Record<string, string>): Promise<void>;
  /** Absent when email isn't configured. */
  email?: { remindContest(c: { title: string; slug: string; startsAt: string }): Promise<unknown> } | undefined;
  settings: SettingsRepository;
  clock: Clock;
}

export class ContestNotifyService {
  constructor(private readonly d: ContestNotifyDeps) {}

  private async state(): Promise<State> {
    const raw = (await this.d.settings.get(SETTINGS_KEY)) as Partial<State> | null;
    return { reminded: raw?.reminded ?? [], resulted: raw?.resulted ?? [] };
  }

  private async mark(kind: keyof State, slug: string): Promise<void> {
    const s = await this.state();
    await this.d.settings.set(SETTINGS_KEY, { ...s, [kind]: [...s[kind], slug].slice(-KEEP) }, "system");
  }

  async run(): Promise<{ reminded: string[]; resulted: string[] }> {
    const now = this.d.clock.nowMs();
    const done = { reminded: [] as string[], resulted: [] as string[] };
    const state = await this.state();
    for (const c of await this.d.repo.list()) {
      const start = c.startsAt.getTime();
      const end = c.endsAt.getTime();

      if (start > now && start - now <= REMIND_BEFORE_MS && !state.reminded.includes(c.slug)) {
        await this.mark("reminded", c.slug);
        const data = { event: "reminder", slug: c.slug, title: c.title, startsAt: c.startsAt.toISOString() };
        for (const userId of await this.d.repo.entrants(c.id)) await this.d.notify(userId, "contest", data);
        await this.d.email?.remindContest({ title: c.title, slug: c.slug, startsAt: data.startsAt });
        done.reminded.push(c.slug);
      }

      if (end <= now && now - end <= RESULTS_WINDOW_MS && !state.resulted.includes(c.slug)) {
        const results = await this.d.contests.settledResults(c.slug);
        if (!results) continue; // not settled yet
        await this.mark("resulted", c.slug);
        const changes = await this.d.contests.ratingChanges(c.slug);
        for (const r of results) {
          const change = changes.get(r.userId);
          await this.d.notify(r.userId, "contest", {
            event: "result",
            slug: c.slug,
            title: c.title,
            rank: String(r.rank),
            entrants: String(results.length),
            ...(change && { rating: String(change.rating), delta: String(change.delta), tier: change.tier.title }),
          });
        }
        done.resulted.push(c.slug);
      }
    }
    if (done.reminded.length || done.resulted.length) logger.info(done, "contest notifications sent");
    return done;
  }
}
