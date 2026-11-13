/**
 * The weekly digest: opt-in, at most one per user per ISO week, sent on
 * Mondays from 09:00 UTC, inside the monthly caps (per user and total).
 */
import { BadRequestError } from "../../errors/AppError.ts";
import { logger } from "../../lib/logger.ts";
import type { EmailRepository } from "../../repositories/email.repository.ts";
import type { Clock } from "../../types/ports.ts";
import type { EmailSender } from "./emailjs.ts";

export interface DigestContent {
  name: string;
  rank: string;
  points: number;
  streak: number;
  daily: { title: string; url: string } | null;
  contests: { title: string; url: string; startsAt: string }[];
}

export interface DigestSources {
  email(userId: string): Promise<string | null>;
  content(userId: string): Promise<DigestContent | null>;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** ISO-8601 week, e.g. "2026-W46". */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

export function renderDigest(c: DigestContent, siteUrl: string): { subject: string; html: string } {
  const link = (url: string, text: string) => `<a href="${esc(url)}" style="color:#0284c7;text-decoration:none;font-weight:600">${esc(text)}</a>`;
  const contests = c.contests.length
    ? `<h3 style="margin:24px 0 8px">Contests this week</h3><ul style="padding-left:18px;margin:0">${c.contests
        .map((x) => `<li style="margin:4px 0">${link(x.url, x.title)} · ${esc(new Date(x.startsAt).toUTCString().slice(0, 22))} UTC</li>`)
        .join("")}</ul>`
    : "";
  const daily = c.daily ? `<p style="margin:16px 0 0">Today's Daily Challenge: ${link(c.daily.url, c.daily.title)} (+15 coins if you solve it today)</p>` : "";
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
<h2 style="margin:0 0 4px">Your week on SFCode</h2>
<p style="margin:0;color:#475569">Hi ${esc(c.name)}: you're a <b>${esc(c.rank)}</b> with <b>${c.points}</b> points${c.streak > 0 ? ` and a <b>${c.streak}-day</b> streak 🔥` : ""}.</p>
${daily}${contests}
<p style="margin:28px 0">${link(`${siteUrl}/problems`, "Keep practising →")}</p>
<p style="font-size:12px;color:#94a3b8">You get this because you turned on the weekly digest. ${link(`${siteUrl}/profile`, "Turn it off")} any time.</p>
</div>`;
  return { subject: `Your SFCode week: ${c.rank}, ${c.points} points`, html };
}

export class DigestService {
  constructor(
    private readonly repo: EmailRepository,
    private readonly sender: EmailSender | undefined,
    private readonly sources: DigestSources,
    private readonly clock: Clock,
    private readonly caps: { total: number; perUser: number },
    private readonly siteUrl: string,
  ) {}

  get enabled(): boolean {
    return this.sender !== undefined;
  }

  prefs(userId: string) {
    return this.repo.prefs(userId).then((p) => ({ ...p, available: this.enabled }));
  }

  async setPrefs(userId: string, weeklyDigest: boolean) {
    await this.repo.setPrefs(userId, weeklyDigest);
    return this.prefs(userId);
  }

  /** Sends one user's digest for `period` if allowed. Returns what happened. */
  private async sendOne(userId: string, kind: string, period: string): Promise<string> {
    const sender = this.sender;
    if (!sender) return "disabled";
    const [to, content] = await Promise.all([this.sources.email(userId), this.sources.content(userId)]);
    if (!to || !content) return "no_address";
    const outcome = await this.repo.claim(userId, kind, period, monthStart(this.clock.now()), this.caps);
    if (outcome !== "claimed") return outcome;
    const { subject, html } = renderDigest(content, this.siteUrl);
    try {
      await sender.send(to, subject, html);
      return "sent";
    } catch (err) {
      await this.repo.markFailed(userId, kind, period);
      logger.warn({ err: err instanceof Error ? err.message : String(err), userId }, "digest send failed");
      return "failed";
    }
  }

  /** Called hourly; does work only on Mondays from 09:00 UTC, once per user per week. */
  async runWeekly(): Promise<Record<string, number>> {
    const now = this.clock.now();
    const counts: Record<string, number> = {};
    if (!this.sender || now.getUTCDay() !== 1 || now.getUTCHours() < 9) return counts;
    const period = isoWeek(now);
    for (const userId of await this.repo.digestSubscribers()) {
      const r = await this.sendOne(userId, "digest", period);
      counts[r] = (counts[r] ?? 0) + 1;
      if (r === "global_cap") break; // nothing else can go out this month
    }
    if (Object.keys(counts).length) logger.info({ period, ...counts }, "weekly digest run");
    return counts;
  }

  /** Sends the caller their own digest now (staff, for checking the template). Counts toward the caps. */
  async sendTest(userId: string): Promise<string> {
    if (!this.sender) throw new BadRequestError("Email isn't configured on this server.");
    return this.sendOne(userId, "test", this.clock.now().toISOString().slice(0, 16));
  }

  async usage() {
    return { sentThisMonth: await this.repo.sentThisMonth(monthStart(this.clock.now())), cap: this.caps.total, perUser: this.caps.perUser, enabled: this.enabled };
  }
}
