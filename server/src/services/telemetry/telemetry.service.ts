/**
 * Self-hosted error tracking and cookie-free page counts. Everything stored
 * goes through the privacy rules in domain/telemetry.ts first.
 */
import { NotFoundError } from "../../errors/AppError.ts";
import { clip, cleanPath, fingerprint, MAX_MESSAGE, MAX_STACK, scrub } from "../../domain/telemetry.ts";
import type { ErrorGroup, TelemetryRepository } from "../../repositories/telemetry.repository.ts";
import type { Clock } from "../../types/ports.ts";
import type { AdminService } from "../admin/admin.service.ts";

/** A flood of reports (a bug in a loop, or someone scripting the endpoint) stops being stored past this per hour. */
export const MAX_REPORTS_PER_HOUR = 500;
const ANALYTICS_DAYS = 30;

export interface ErrorReport {
  source: "client" | "server";
  name: string;
  message: string;
  stack?: string | null;
  path?: string | null;
  userAgent?: string | null;
  userId?: string | null;
}

export class TelemetryService {
  private window = { startedAt: 0, count: 0 };

  constructor(
    private readonly repo: TelemetryRepository,
    private readonly admin: AdminService,
    private readonly clock: Clock,
  ) {}

  /** Never throws: reporting an error must not cause another one. */
  async report(r: ErrorReport): Promise<void> {
    try {
      const now = this.clock.nowMs();
      if (now - this.window.startedAt > 3_600_000) this.window = { startedAt: now, count: 0 };
      if (this.window.count >= MAX_REPORTS_PER_HOUR) return;
      this.window.count++;
      const name = clip(scrub(r.name || "Error"), 100);
      const message = clip(scrub(r.message || "(no message)"), MAX_MESSAGE);
      const stack = r.stack ? clip(scrub(r.stack), MAX_STACK) : null;
      await this.repo.recordError({
        fingerprint: fingerprint(r.source, name, message, stack),
        source: r.source,
        name,
        message,
        stack,
        path: r.path ? cleanPath(r.path) : null,
        userAgent: r.userAgent ? clip(r.userAgent, 200) : null,
        userId: r.userId ?? null,
      });
    } catch {
      /* the database is down or similar: dropping a report is fine */
    }
  }

  async pageView(rawPath: string): Promise<void> {
    const path = cleanPath(rawPath);
    if (!path) return;
    try {
      await this.repo.countView(new Date(this.clock.nowMs()).toISOString().slice(0, 10), path);
    } catch {
      /* best effort */
    }
  }

  async errors(actor: string, open: boolean): Promise<(Omit<ErrorGroup, "firstSeen" | "lastSeen" | "resolvedAt"> & { firstSeen: string; lastSeen: string; resolvedAt: string | null })[]> {
    await this.admin.require(actor, "admin");
    return (await this.repo.errors({ open, limit: 200 })).map((e) => ({
      ...e,
      firstSeen: e.firstSeen.toISOString(),
      lastSeen: e.lastSeen.toISOString(),
      resolvedAt: e.resolvedAt?.toISOString() ?? null,
    }));
  }

  async resolve(actor: string, fp: string): Promise<void> {
    await this.admin.require(actor, "admin");
    if (!(await this.repo.resolve(fp))) throw new NotFoundError("No open error with that id.");
    await this.admin.record(actor, "error.resolve", null, { fingerprint: fp });
  }

  /** Views per day (every day in the window) and the most-viewed pages. */
  async analytics(actor: string): Promise<{ days: { day: string; views: number }[]; pages: { path: string; views: number }[]; total: number }> {
    await this.admin.require(actor, "reviewer");
    const now = this.clock.nowMs();
    const days: { day: string; views: number }[] = [];
    for (let i = ANALYTICS_DAYS - 1; i >= 0; i--) days.push({ day: new Date(now - i * 86_400_000).toISOString().slice(0, 10), views: 0 });
    const rows = await this.repo.views(days[0]?.day ?? "");
    const byDay = new Map(days.map((d) => [d.day, d]));
    const byPath = new Map<string, number>();
    for (const r of rows) {
      const d = byDay.get(r.day);
      if (d) d.views += r.views;
      byPath.set(r.path, (byPath.get(r.path) ?? 0) + r.views);
    }
    const pages = [...byPath].map(([path, views]) => ({ path, views })).sort((a, b) => b.views - a.views).slice(0, 15);
    return { days, pages, total: days.reduce((n, d) => n + d.views, 0) };
  }
}
