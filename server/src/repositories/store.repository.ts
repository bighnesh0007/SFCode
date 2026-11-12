/** Purchases and equipped cosmetics. */
import { and, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase } from "../data/postgres/client.ts";
import { storePurchases, userEquipped } from "../data/postgres/schema.ts";

export type PurchaseOutcome = "bought" | "owned" | "insufficient";

export interface StoreRepository {
  owned(userId: string): Promise<string[]>;
  spent(userId: string): Promise<number>;
  /**
   * Buys if `earned - spent >= price`, atomically. A per-user advisory lock
   * serialises purchases and `spent` is re-read under it, so two concurrent
   * buys can't both spend the same coins.
   */
  purchase(userId: string, itemId: string, price: number, earned: number): Promise<PurchaseOutcome>;
  equipped(userIds: string[]): Promise<Map<string, Record<string, string>>>;
  equip(userId: string, slot: string, itemId: string): Promise<void>;
  unequip(userId: string, slot: string): Promise<void>;
}

export class PgStoreRepository implements StoreRepository {
  constructor(private readonly db: PgDatabase) {}

  async owned(userId: string): Promise<string[]> {
    return (await this.db.select({ id: storePurchases.itemId }).from(storePurchases).where(eq(storePurchases.userId, userId))).map((r) => r.id);
  }

  async spent(userId: string): Promise<number> {
    const [row] = await this.db.select({ n: sql<number>`coalesce(sum(${storePurchases.price}), 0)::int` }).from(storePurchases).where(eq(storePurchases.userId, userId));
    return row?.n ?? 0;
  }

  async purchase(userId: string, itemId: string, price: number, earned: number): Promise<PurchaseOutcome> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"store:" + userId}))`);
      const already = await tx.select({ id: storePurchases.itemId }).from(storePurchases).where(and(eq(storePurchases.userId, userId), eq(storePurchases.itemId, itemId))).limit(1);
      if (already.length > 0) return "owned";
      const [row] = await tx.select({ n: sql<number>`coalesce(sum(${storePurchases.price}), 0)::int` }).from(storePurchases).where(eq(storePurchases.userId, userId));
      if (earned - (row?.n ?? 0) < price) return "insufficient";
      await tx.insert(storePurchases).values({ userId, itemId, price });
      return "bought";
    });
  }

  async equipped(userIds: string[]): Promise<Map<string, Record<string, string>>> {
    const out = new Map<string, Record<string, string>>();
    if (userIds.length === 0) return out;
    for (const r of await this.db.select().from(userEquipped).where(inArray(userEquipped.userId, userIds))) {
      out.set(r.userId, { ...(out.get(r.userId) ?? {}), [r.slot]: r.itemId });
    }
    return out;
  }

  async equip(userId: string, slot: string, itemId: string): Promise<void> {
    await this.db.insert(userEquipped).values({ userId, slot, itemId }).onConflictDoUpdate({ target: [userEquipped.userId, userEquipped.slot], set: { itemId } });
  }

  async unequip(userId: string, slot: string): Promise<void> {
    await this.db.delete(userEquipped).where(and(eq(userEquipped.userId, userId), eq(userEquipped.slot, slot)));
  }
}
