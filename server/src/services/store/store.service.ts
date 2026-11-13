/**
 * Coins and the cosmetic store.
 *
 * Coins are DERIVED, never stored as a balance: earned = points of every first
 * solve on a scored track + contest prizes; spent = sum of purchase prices.
 * Nothing can drift, and existing solves count from day one.
 */
import { ConflictError, NotFoundError, ValidationError } from "../../errors/AppError.ts";
import { SCORED_TRACKS } from "../../domain/challenge.ts";
import { itemById, STORE_ITEMS, type StoreItem } from "../../domain/store.ts";
import { PointsService } from "../points/points.service.ts";
import type { ChallengeSubmissionRepository } from "../../repositories/challengeSubmission.repository.ts";
import type { StoreRepository } from "../../repositories/store.repository.ts";
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

export interface StoreView {
  wallet: Wallet | null;
  items: (StoreItem & { owned: boolean; equipped: boolean })[];
}

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

  async view(userId: string | null): Promise<StoreView> {
    if (!userId) return { wallet: null, items: STORE_ITEMS.map((i) => ({ ...i, owned: false, equipped: false })) };
    const [wallet, owned, equipped] = await Promise.all([this.wallet(userId), this.repo.owned(userId), this.repo.equipped([userId])]);
    const mine = equipped.get(userId) ?? {};
    return { wallet, items: STORE_ITEMS.map((i) => ({ ...i, owned: owned.includes(i.id), equipped: mine[i.slot] === i.id })) };
  }

  async buy(userId: string, itemId: string): Promise<StoreView> {
    const item = itemById(itemId);
    if (!item) throw new NotFoundError("No such item.");
    const w = await this.wallet(userId);
    const outcome = await this.repo.purchase(userId, item.id, item.price, w.earnedFromSolves + w.earnedFromContests + w.earnedFromDaily);
    if (outcome === "owned") throw new ConflictError("You already own this.");
    if (outcome === "insufficient") throw new ValidationError(`You need ${item.price} coins; you have ${w.balance}.`);
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
}
