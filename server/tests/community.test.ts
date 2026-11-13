import { describe, expect, it } from "vitest";
import { PROBLEMS_DIR } from "../src/container.ts";
import type { ProfileRecord, ProfileRepository } from "../src/repositories/profile.repository.ts";
import { ChallengeCatalog } from "../src/services/challenges/catalog.ts";
import { CommunityService } from "../src/services/community/community.service.ts";
import type { IdentityLookup, PublicIdentity } from "../src/services/identity/clerkIdentity.ts";
import { fixedClock, MemorySubmissionRepository } from "./fakes.ts";

const catalog = ChallengeCatalog.load(PROBLEMS_DIR);

class MemoryProfiles implements ProfileRepository {
  readonly rows = new Map<string, ProfileRecord>();
  count() {
    return Promise.resolve(this.rows.size);
  }
  findByUser(userId: string) {
    return Promise.resolve(this.rows.get(userId) ?? null);
  }
  findByHandle(handle: string) {
    return Promise.resolve([...this.rows.values()].find((p) => p.handle.toLowerCase() === handle.toLowerCase()) ?? null);
  }
  findByUsers(ids: string[]) {
    return Promise.resolve(ids.flatMap((id) => {
      const r = this.rows.get(id);
      return r ? [r] : [];
    }));
  }
  create(p: Omit<ProfileRecord, "createdAt">) {
    if (this.rows.has(p.userId)) return Promise.resolve(true);
    if ([...this.rows.values()].some((r) => r.handle.toLowerCase() === p.handle.toLowerCase())) return Promise.resolve(false);
    this.rows.set(p.userId, { ...p, createdAt: new Date(0) });
    return Promise.resolve(true);
  }
  update(userId: string, changes: { handle?: string; displayName?: string }) {
    if (changes.handle && [...this.rows.values()].some((r) => r.userId !== userId && r.handle.toLowerCase() === changes.handle?.toLowerCase())) return Promise.resolve(false);
    const r = this.rows.get(userId);
    if (r) this.rows.set(userId, { ...r, ...(changes.handle ? { handle: changes.handle } : {}), ...(changes.displayName ? { displayName: changes.displayName } : {}) });
    return Promise.resolve(true);
  }
}

const identities: Record<string, PublicIdentity> = {
  ada: { username: "ada", displayName: "Ada Lovelace", imageUrl: "https://img/ada" },
  anon: { username: null, displayName: null, imageUrl: null },
  ada2: { username: "ADA", displayName: "Another Ada", imageUrl: null },
  admin: { username: "admin", displayName: "Sneaky", imageUrl: null },
};
const lookup: IdentityLookup = { lookup: (id) => Promise.resolve(identities[id] ?? identities.anon ?? { username: null, displayName: null, imageUrl: null }) };

function setup() {
  const clock = fixedClock(Date.UTC(2026, 10, 12));
  const subs = new MemorySubmissionRepository(clock);
  const profiles = new MemoryProfiles();
  const service = new CommunityService(catalog, subs, profiles, lookup, clock);
  const solve = async (userId: string, slug: string, daysAgo = 0) => {
    const r = await subs.createRunning({ userId, problemSlug: slug, orgId: "00D", files: {} });
    if (!r) throw new Error("setup");
    const at = new Date(clock.nowMs() - daysAgo * 86_400_000);
    await subs.complete(r.id, "accepted", { verdict: "accepted", testsRun: 1, testsPassed: 1, tests: [], compileErrors: [], coverage: [], message: null }, at);
    const row = subs.rows.get(r.id);
    if (row) row.createdAt = at;
  };
  return { service, profiles, solve, clock };
}

describe("profiles", () => {
  it("seeds the handle from the Clerk username, else a neutral learner-xxxxxx (never the email)", async () => {
    const { service } = setup();
    expect((await service.ensureProfile("ada")).handle).toBe("ada");
    expect((await service.ensureProfile("anon")).handle).toMatch(/^learner-[0-9a-f]{6}$/);
  });

  it("de-duplicates handles case-insensitively, and never hands out a reserved one", async () => {
    const { service } = setup();
    await service.ensureProfile("ada");
    expect((await service.ensureProfile("ada2")).handle).toMatch(/^ADA-[0-9a-f]{6}$/);
    expect((await service.ensureProfile("admin")).handle).toMatch(/^learner-/);
  });

  it("validates handle changes", async () => {
    const { service } = setup();
    await service.ensureProfile("ada");
    await service.ensureProfile("anon");
    await expect(service.updateProfile("anon", { handle: "ADA" })).rejects.toThrow(/taken/);
    await expect(service.updateProfile("anon", { handle: "admin" })).rejects.toThrow(/reserved/);
    await expect(service.updateProfile("anon", { handle: "a" })).rejects.toThrow(/3–30/);
    expect((await service.updateProfile("anon", { handle: "grace_h", displayName: " Grace " })).displayName).toBe("Grace");
  });
});

describe("scoring and leaderboard", () => {
  it("scores each problem once, by track and difficulty", async () => {
    const { service, solve } = setup();
    await service.ensureProfile("ada");
    await solve("ada", "text-utils"); // Apex Easy 3
    await solve("ada", "text-utils"); // repeat: no extra points
    await solve("ada", "won-revenue-rollup"); // Apex Medium 6
    await solve("ada", "soql-accounts-with-won-deals"); // SOQL Hard 3
    await solve("ada", "lwc-click-counter"); // LWC Easy 4: graded in the server sandbox, so it scores
    const me = await service.me("ada");
    expect(me).toMatchObject({ score: 16, solved: 4, rank: 1 });
    expect(me.byTrack.find((t) => t.track === "lwc")).toMatchObject({ solved: 1 });
    // 16 points: Trailblazer; the cheap tier endpoint agrees with the full profile.
    expect(me.tier).toMatchObject({ id: "trailblazer", points: 16 });
    expect(await service.myTier("ada")).toEqual(me.tier);
    expect((await service.leaderboard("all"))[0]?.tier).toEqual({ id: "trailblazer", title: "Trailblazer" });
  });

  it("ranks by score, then by who got there first", async () => {
    const { service, solve } = setup();
    for (const u of ["ada", "anon"]) await service.ensureProfile(u);
    await solve("anon", "text-utils", 5);
    await solve("ada", "account-rating-default", 1);
    const board = await service.leaderboard("all");
    expect(board.map((r) => [r.rank, r.handle.startsWith("learner") ? "anon" : r.handle, r.score])).toEqual([
      [1, "anon", 3],
      [2, "ada", 3],
    ]);
  });

  it("the 30-day board only counts recent solves", async () => {
    const { service, solve } = setup();
    await service.ensureProfile("ada");
    await solve("ada", "text-utils", 60);
    await solve("ada", "protect-closed-won", 3);
    expect((await service.leaderboard("all"))[0]?.score).toBe(6);
    expect((await service.leaderboard("30d"))[0]?.score).toBe(3);
  });

  it("the 7-day board and per-track boards", async () => {
    const { service, solve } = setup();
    for (const u of ["ada", "bob"]) await service.ensureProfile(u);
    await solve("ada", "text-utils", 10); // apex Easy, 3 pts, outside 7 days
    await solve("ada", "soql-hot-tech-accounts", 2); // soql Easy, 1 pt
    await solve("bob", "protect-closed-won", 1); // apex Easy, 3 pts
    // Only "ada" gets a handle from the fake identity lookup; everyone else is learner-xxxx.
    const handles = (rows: { handle: string; score: number }[]) => rows.map((r) => [r.handle === "ada" ? "ada" : "bob", r.score]);
    expect(handles(await service.leaderboard("7d"))).toEqual([["bob", 3], ["ada", 1]]);
    expect(handles(await service.leaderboard("all", 100, "apex"))).toEqual([["ada", 3], ["bob", 3]]);
    expect(handles(await service.leaderboard("all", 100, "soql"))).toEqual([["ada", 1]]);
    expect(handles(await service.leaderboard("7d", 100, "apex"))).toEqual([["bob", 3]]);
  });

  it("site stats: problems, learners and this week's first solves", async () => {
    const { service, solve } = setup();
    for (const u of ["ada", "bob"]) await service.ensureProfile(u);
    await solve("ada", "text-utils", 1);
    await solve("ada", "text-utils", 1); // repeat: one first solve
    await solve("bob", "protect-closed-won", 20); // older than a week
    const s = await service.stats();
    expect(s).toMatchObject({ learners: 2, solvesThisWeek: 1, communityProblems: 0 });
    expect(s.problems).toBeGreaterThan(20);
  });

  it("404s an unknown handle", async () => {
    await expect(setup().service.byHandle("nobody")).rejects.toThrow(/No learner/);
  });
});
