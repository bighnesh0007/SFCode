/**
 * Coins and the cosmetic store.
 *
 * Coins are DERIVED, never stored as a balance: earned = points of every first
 * solve on a scored track + contest prizes; spent = sum of purchase prices.
 * Nothing can drift, and existing solves count from day one.
 */
import { ConflictError, NotFoundError, ValidationError } from "../../errors/AppError.ts";
import { SCORED_TRACKS } from "../../domain/challenge.ts";
import { isFreezeId, itemById, MAX_FREEZES, STORE_ITEMS, STREAK_FREEZE, type StoreItem } from "../../domain/store.ts";
import { PointsService } from "../points/points.service.ts";
import type { ChallengeSubmissionRepository } from "../../repositories/challengeSubmission.repository.ts";
import type { StoreRepository } from "../../repositories/store.repository.ts";
import type { SettingsRepository } from "../../repositories/settings.repository.ts";
import type { AdminService } from "../admin/admin.service.ts";
import type { ChallengeCatalog } from "../challenges/catalog.ts";

export interface PrizeSource {
  prizes(): Promise<Map<string, number>>;
}

export interface Wallet {
  earnedFromSolves: number;
  earnedFromContests: number;
  earnedFromDaily: number;
  spent: number;
  balance: number;
}

export interface FreezeOffer {
  id: string;
  name: string;
  description: string;
  price: number;
  max: number;
  /** Bought so far / not yet used by the current streak. */
  owned: number;
  available: number;
}

export interface StoreView {
  freeze: FreezeOffer;
  wallet: Wallet | null;
  items: (StoreItem & { owned: boolean; equipped: boolean })[];
}

/** Hint n (1-based) costs 2n coins: cheap nudges, pricier near-answers. Free after solving. */
export const hintPrice = (n: number) => 2 * n;
const hintItemId = (slug: string, n: number) => `hint:${slug}:${n}`;

export interface LearningView {
  hintCount: number;
  /** Price of each hint, cheapest first. */
  prices: number[];
  /** Revealed hints, in order. */
  hints: string[];
  solved: boolean;
  /** Only once solved; null otherwise or when the problem has none. */
  editorial: string | null;
  hasEditorial: boolean;
}

/** Admin changes to a built-in item: a new price, or retired from sale. Stored in app settings. */
export interface ItemOverride {
  price?: number;
  retired?: boolean;
}
export const STORE_OVERRIDES_KEY = "store-overrides";

export class StoreService {
  constructor(
    private readonly repo: StoreRepository,
    private readonly submissions: ChallengeSubmissionRepository,
    private readonly catalog: ChallengeCatalog,
    private readonly contests: PrizeSource,
    private readonly daily?: { coins(userId: string): Promise<number> },
    private readonly points: PointsService = new PointsService(undefined, undefined),
  ) {}

  async wallet(userId: string): Promise<Wallet> {
    const solves = await this.submissions.firstSolves(undefined, userId);
    const table = await this.points.table();
    const earnedFromSolves = solves.reduce((n, s) => {
      const c = this.catalog.get(s.slug);
      return c && SCORED_TRACKS.includes(c.track) ? n + table.coins(c.track, c.difficulty, s.at) : n;
    }, 0);
    const earnedFromContests = (await this.contests.prizes()).get(userId) ?? 0;
    const spent = await this.repo.spent(userId);
    const earnedFromDaily = this.daily ? await this.daily.coins(userId) : 0;
    return { earnedFromSolves, earnedFromContests, earnedFromDaily, spent, balance: earnedFromSolves + earnedFromContests + earnedFromDaily - spent };
  }

  private overridesSource: (() => Promise<Record<string, ItemOverride>>) | undefined;
  /** Where admin price and retirement changes come from (app settings); wired after construction. */
  setOverrides(fn: () => Promise<Record<string, ItemOverride>>): void {
    this.overridesSource = fn;
  }

  /** Every item with its current price and whether it's still for sale. */
  async pricedItems(): Promise<(StoreItem & { retired: boolean; basePrice: number })[]> {
    const overrides = this.overridesSource ? await this.overridesSource().catch(() => ({})) : {};
    return STORE_ITEMS.map((i) => {
      const o = (overrides as Record<string, ItemOverride>)[i.id] ?? {};
      return { ...i, basePrice: i.price, price: o.price ?? i.price, retired: o.retired === true };
    });
  }

  private adminTools: { admin: AdminService; settings: SettingsRepository } | undefined;
  /** For the admin store tab: who may change prices, and where changes are saved. */
  setAdminTools(tools: { admin: AdminService; settings: SettingsRepository }): void {
    this.adminTools = tools;
    this.setOverrides(async () => ((await tools.settings.get(STORE_OVERRIDES_KEY)) as Record<string, ItemOverride> | null) ?? {});
  }

  private tools() {
    if (!this.adminTools) throw new ConflictError("Store administration needs the database.");
    return this.adminTools;
  }

  /** Every item with its base and current price, whether it's retired, and how many own it. Admins only. */
  async adminItems(actor: string): Promise<(StoreItem & { retired: boolean; basePrice: number; owners: number })[]> {
    await this.tools().admin.require(actor, "admin");
    const [items, owners] = await Promise.all([this.pricedItems(), this.repo.ownerCounts()]);
    return items.map((i) => ({ ...i, owners: owners.get(i.id) ?? 0 }));
  }

  /** Changes an item's price or takes it off sale. Owners keep what they bought. */
  async setItem(actor: string, itemId: string, change: { price: number; retired: boolean }): Promise<void> {
    const { admin, settings } = this.tools();
    await admin.require(actor, "admin");
    const base = STORE_ITEMS.find((i) => i.id === itemId);
    if (!base) throw new NotFoundError("No such item.");
    if (!Number.isInteger(change.price) || change.price < 0 || change.price > 100_000) throw new ValidationError("Price must be a whole number from 0 to 100,000.");
    const current = ((await settings.get(STORE_OVERRIDES_KEY)) as Record<string, ItemOverride> | null) ?? {};
    const next: ItemOverride = {};
    if (change.price !== base.price) next.price = change.price;
    if (change.retired) next.retired = true;
    const rest = Object.fromEntries(Object.entries(current).filter(([id]) => id !== itemId));
    await settings.set(STORE_OVERRIDES_KEY, Object.keys(next).length ? { ...rest, [itemId]: next } : rest, actor);
    await admin.record(actor, "store.update", null, { itemId, price: change.price, retired: change.retired });
  }

  private freezeUsage: ((userId: string) => Promise<number>) | undefined;
  /** How many freezes the user's current streak is using (from the community service; wired after construction). */
  setFreezeUsage(fn: (userId: string) => Promise<number>): void {
    this.freezeUsage = fn;
  }

  /** Streak Freezes bought so far (each purchase is its own row). */
  async freezesOwned(userId: string): Promise<number> {
    return (await this.repo.owned(userId)).filter(isFreezeId).length;
  }

  async view(userId: string | null): Promise<StoreView> {
    const freezeOffer = { ...STREAK_FREEZE, max: MAX_FREEZES };
    const strip = ({ retired: _r, basePrice: _b, ...item }: StoreItem & { retired: boolean; basePrice: number }) => item;
    const items = await this.pricedItems();
    // Retired items leave the shop window, but anyone who bought one still sees and can wear it.
    if (!userId) return { wallet: null, items: items.filter((i) => !i.retired).map((i) => ({ ...strip(i), owned: false, equipped: false })), freeze: { ...freezeOffer, owned: 0, available: 0 } };
    const [wallet, owned, equipped] = await Promise.all([this.wallet(userId), this.repo.owned(userId), this.repo.equipped([userId])]);
    const mine = equipped.get(userId) ?? {};
    const freezes = owned.filter(isFreezeId).length;
    const used = this.freezeUsage ? await this.freezeUsage(userId) : 0;
    return {
      wallet,
      items: items.filter((i) => !i.retired || owned.includes(i.id)).map((i) => ({ ...strip(i), owned: owned.includes(i.id), equipped: mine[i.slot] === i.id })),
      freeze: { ...freezeOffer, owned: freezes, available: Math.max(0, freezes - used) },
    };
  }

  async buy(userId: string, itemId: string): Promise<StoreView> {
    if (itemId === STREAK_FREEZE.id) return this.buyFreeze(userId);
    const item = (await this.pricedItems()).find((i) => i.id === itemId);
    if (!item) throw new NotFoundError("No such item.");
    if (item.retired) throw new ConflictError("This item is no longer for sale.");
    const w = await this.wallet(userId);
    const outcome = await this.repo.purchase(userId, item.id, item.price, w.earnedFromSolves + w.earnedFromContests + w.earnedFromDaily);
    if (outcome === "owned") throw new ConflictError("You already own this.");
    if (outcome === "insufficient") throw new ValidationError(`You need ${item.price} coins; you have ${w.balance}.`);
    return this.view(userId);
  }

  private async buyFreeze(userId: string): Promise<StoreView> {
    const owned = await this.freezesOwned(userId);
    const used = this.freezeUsage ? await this.freezeUsage(userId) : 0;
    if (owned - used >= MAX_FREEZES) throw new ConflictError(`You can hold at most ${MAX_FREEZES} unused Streak Freezes.`);
    const w = await this.wallet(userId);
    // Next numbered id; a concurrent buy picking the same number gets "owned" (a clean 409), never a double charge.
    const outcome = await this.repo.purchase(userId, `${STREAK_FREEZE.id}-${owned + 1}`, STREAK_FREEZE.price, w.earnedFromSolves + w.earnedFromContests + w.earnedFromDaily);
    if (outcome === "owned") throw new ConflictError("That purchase is already being processed. Try again.");
    if (outcome === "insufficient") throw new ValidationError(`You need ${STREAK_FREEZE.price} coins; you have ${w.balance}.`);
    return this.view(userId);
  }

  async equip(userId: string, itemId: string, on: boolean): Promise<StoreView> {
    const item = itemById(itemId);
    if (!item) throw new NotFoundError("No such item.");
    if (!(await this.repo.owned(userId)).includes(item.id)) throw new ValidationError("Buy it before wearing it.");
    if (on) await this.repo.equip(userId, item.slot, item.id);
    else await this.repo.unequip(userId, item.slot);
    return this.view(userId);
  }

  /** Equipped style tokens per user, for profiles and leaderboards. */
  async cosmetics(userIds: string[]): Promise<Map<string, Record<string, string>>> {
    const equipped = await this.repo.equipped(userIds);
    const out = new Map<string, Record<string, string>>();
    for (const [userId, slots] of equipped) {
      const styles: Record<string, string> = {};
      for (const [slot, id] of Object.entries(slots)) {
        const item = itemById(id);
        if (item) styles[slot] = item.style;
      }
      out.set(userId, styles);
    }
    return out;
  }

  private async solved(userId: string, slug: string): Promise<boolean> {
    return (await this.submissions.firstSolves(undefined, userId)).some((s) => s.slug === slug);
  }

  /** Hints and the editorial for one problem, as far as this learner has unlocked them. */
  async learning(userId: string | null, slug: string): Promise<LearningView> {
    const c = this.catalog.get(slug);
    if (!c) throw new NotFoundError("Problem not found.");
    const all = c.hints ?? [];
    const prices = all.map((_, i) => hintPrice(i + 1));
    const base = { hintCount: all.length, prices, hasEditorial: c.editorial !== undefined };
    if (!userId) return { ...base, hints: [], solved: false, editorial: null };
    const solved = await this.solved(userId, slug);
    if (solved) return { ...base, hints: all, solved, editorial: c.editorial ?? null };
    const owned = new Set(await this.repo.owned(userId));
    // Hints are bought in order, so the revealed ones are a prefix.
    let n = 0;
    while (n < all.length && owned.has(hintItemId(slug, n + 1))) n++;
    return { ...base, hints: all.slice(0, n), solved, editorial: null };
  }

  /** Buys the next hint. Asking for one already revealed is a no-op; skipping ahead is refused. */
  async revealHint(userId: string, slug: string, n: number): Promise<LearningView> {
    const view = await this.learning(userId, slug);
    if (n < 1 || n > view.hintCount) throw new NotFoundError("That hint doesn't exist.");
    if (n <= view.hints.length) return view;
    if (n !== view.hints.length + 1) throw new ValidationError(`Reveal hint ${view.hints.length + 1} first.`);
    const w = await this.wallet(userId);
    const price = hintPrice(n);
    const outcome = await this.repo.purchase(userId, hintItemId(slug, n), price, w.earnedFromSolves + w.earnedFromContests + w.earnedFromDaily);
    if (outcome === "insufficient") throw new ValidationError(`Hint ${n} costs ${price} coins; you have ${w.balance}. Solve a problem or the daily challenge to earn more.`);
    return this.learning(userId, slug);
  }
}
