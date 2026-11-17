import { describe, expect, it } from "vitest";
import { ContestNotifyService } from "../src/services/contests/contestNotify.service.ts";
import type { ContestRatingChange } from "../src/services/contests/contest.service.ts";
import type { ContestRecord } from "../src/repositories/contest.repository.ts";

const MIN = 60_000;
const start = Date.parse("2026-11-22T14:30:00Z");
const contest = { id: "c1", slug: "weekly-contest-1", title: "Weekly Contest 1", startsAt: new Date(start), endsAt: new Date(start + 90 * MIN) } as ContestRecord;

function setup() {
  let now = 0;
  const store = new Map<string, unknown>();
  const bell: { userId: string; data: Record<string, string> }[] = [];
  const emails: string[] = [];
  let settled = false;
  const svc = new ContestNotifyService({
    repo: { list: () => Promise.resolve([contest]), entrants: () => Promise.resolve(["ann", "bob"]) },
    contests: {
      settledResults: () => Promise.resolve(settled ? [{ userId: "ann", rank: 1, score: 30 }, { userId: "bob", rank: 2, score: 10 }] : null),
      ratingChanges: () => Promise.resolve(new Map<string, ContestRatingChange>([["ann", { rating: 1520, delta: 20, tier: { id: "ranger", title: "Ranger" } }]])),
    },
    notify: (userId, _kind, data) => (bell.push({ userId, data }), Promise.resolve()),
    email: { remindContest: (c) => (emails.push(c.slug), Promise.resolve()) },
    settings: { get: (k) => Promise.resolve(store.get(k) ?? null), set: (k, v) => (store.set(k, v), Promise.resolve()) },
    clock: { now: () => new Date(now), nowMs: () => now },
  });
  return { svc, bell, emails, at: (t: number) => (now = t), settle: () => (settled = true) };
}

describe("contest notifications", () => {
  it("reminds entrants and emails opt-ins once, inside the hour before the start", async () => {
    const t = setup();
    t.at(start - 61 * MIN);
    expect((await t.svc.run()).reminded).toEqual([]); // too early
    t.at(start - 55 * MIN);
    expect((await t.svc.run()).reminded).toEqual(["weekly-contest-1"]);
    t.at(start - 50 * MIN);
    expect((await t.svc.run()).reminded).toEqual([]); // already done
    expect(t.bell.map((b) => [b.userId, b.data.event])).toEqual([["ann", "reminder"], ["bob", "reminder"]]);
    expect(t.emails).toEqual(["weekly-contest-1"]);
    t.at(start + MIN);
    expect((await t.svc.run()).reminded).toEqual([]); // never after the start
  });

  it("announces results once they settle, with the rating change for rated entrants", async () => {
    const t = setup();
    t.at(start + 100 * MIN);
    expect((await t.svc.run()).resulted).toEqual([]); // ended but not settled
    t.settle();
    expect((await t.svc.run()).resulted).toEqual(["weekly-contest-1"]);
    expect((await t.svc.run()).resulted).toEqual([]);
    expect(t.bell.map((b) => b.data)).toEqual([
      { event: "result", slug: "weekly-contest-1", title: "Weekly Contest 1", rank: "1", entrants: "2", rating: "1520", delta: "20", tier: "Ranger" },
      { event: "result", slug: "weekly-contest-1", title: "Weekly Contest 1", rank: "2", entrants: "2" },
    ]);
  });

  it("never announces old results (e.g. the first run after a deploy)", async () => {
    const t = setup();
    t.settle();
    t.at(start + 90 * MIN + 49 * 60 * MIN);
    expect((await t.svc.run()).resulted).toEqual([]);
    expect(t.bell).toEqual([]);
  });
});
