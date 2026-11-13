import { describe, expect, it } from "vitest";
import type { Challenge } from "../src/domain/challenge.ts";
import type { ChallengeSubmissionRepository } from "../src/repositories/challengeSubmission.repository.ts";
import type { PurchaseOutcome, StoreRepository } from "../src/repositories/store.repository.ts";
import type { ChallengeCatalog } from "../src/services/challenges/catalog.ts";
import { hintPrice, StoreService } from "../src/services/store/store.service.ts";

class MemoryStore implements StoreRepository {
  rows: { userId: string; itemId: string; price: number }[] = [];
  owned(userId: string) {
    return Promise.resolve(this.rows.filter((r) => r.userId === userId).map((r) => r.itemId));
  }
  spent(userId: string) {
    return Promise.resolve(this.rows.filter((r) => r.userId === userId).reduce((n, r) => n + r.price, 0));
  }
  async purchase(userId: string, itemId: string, price: number, earned: number): Promise<PurchaseOutcome> {
    if ((await this.owned(userId)).includes(itemId)) return "owned";
    if (earned - (await this.spent(userId)) < price) return "insufficient";
    this.rows.push({ userId, itemId, price });
    return "bought";
  }
  equipped() {
    return Promise.resolve(new Map<string, Record<string, string>>());
  }
  equip() {
    return Promise.resolve();
  }
  unequip() {
    return Promise.resolve();
  }
}

const problem = (slug: string, extra: Partial<Challenge>): Challenge =>
  ({ slug, title: slug, track: "apex", difficulty: "Easy", category: "x", order: 1, tags: [], statement: "", files: [], starter: {}, reference: {}, testClass: { name: "T", source: "" }, ...extra });

function setup(coinsEarned: number) {
  const problems = new Map([
    ["p1", problem("p1", { hints: ["first nudge", "second nudge", "nearly the answer"], editorial: "The write-up." })],
    ["paid", problem("paid", {})], // a solved problem that earns coins; no hints
    ["bare", problem("bare", {})],
  ]);
  const solves: { userId: string; slug: string; at: Date }[] = [];
  const catalog = { get: (s: string) => problems.get(s) } as unknown as ChallengeCatalog;
  const subs = { firstSolves: (_since: unknown, userId?: string) => Promise.resolve(solves.filter((s) => s.userId === userId)) } as unknown as ChallengeSubmissionRepository;
  const repo = new MemoryStore();
  const store = new StoreService(repo, subs, catalog, { prizes: () => Promise.resolve(new Map([["u1", coinsEarned]])) });
  return { store, repo, solves };
}

describe("hints and editorials", () => {
  it("signed out: counts and prices only, nothing revealed", async () => {
    const { store } = setup(0);
    expect(await store.learning(null, "p1")).toEqual({ hintCount: 3, prices: [2, 4, 6], hasEditorial: true, hints: [], solved: false, editorial: null });
    expect(await store.learning(null, "bare")).toMatchObject({ hintCount: 0, hasEditorial: false });
    await expect(store.learning(null, "nope")).rejects.toThrow(/not found/i);
  });

  it("hints are bought in order, cost coins, and re-asking is free", async () => {
    const { store, repo } = setup(hintPrice(1) + hintPrice(2));
    await expect(store.revealHint("u1", "p1", 2)).rejects.toThrow(/Reveal hint 1 first/);
    expect((await store.revealHint("u1", "p1", 1)).hints).toEqual(["first nudge"]);
    expect((await store.revealHint("u1", "p1", 1)).hints).toEqual(["first nudge"]);
    expect((await store.revealHint("u1", "p1", 2)).hints).toEqual(["first nudge", "second nudge"]);
    expect(repo.rows.map((r) => [r.itemId, r.price])).toEqual([["hint:p1:1", 2], ["hint:p1:2", 4]]);
    await expect(store.revealHint("u1", "p1", 3)).rejects.toThrow(/costs 6 coins; you have 0/);
    await expect(store.revealHint("u1", "p1", 4)).rejects.toThrow(/doesn't exist/);
    // Another learner's purchases don't reveal anything for this one.
    expect((await store.learning("u2", "p1")).hints).toEqual([]);
  });

  it("solving unlocks every hint and the editorial for free", async () => {
    const { store, repo, solves } = setup(0);
    expect((await store.learning("u1", "p1")).editorial).toBeNull();
    solves.push({ userId: "u1", slug: "p1", at: new Date() });
    expect(await store.learning("u1", "p1")).toMatchObject({ solved: true, hints: ["first nudge", "second nudge", "nearly the answer"], editorial: "The write-up." });
    expect((await store.revealHint("u1", "p1", 3)).hints).toHaveLength(3);
    expect(repo.rows).toEqual([]);
  });
});
