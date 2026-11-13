import { describe, expect, it } from "vitest";
import { STORE_ITEMS } from "../src/domain/store.ts";
import type { ChallengeSubmissionRepository } from "../src/repositories/challengeSubmission.repository.ts";
import type { SettingsRepository } from "../src/repositories/settings.repository.ts";
import type { AdminService } from "../src/services/admin/admin.service.ts";
import type { ChallengeCatalog } from "../src/services/challenges/catalog.ts";
import { StoreService } from "../src/services/store/store.service.ts";
import { MemoryStore } from "./fakes.ts";

const ITEM = STORE_ITEMS[0];
if (!ITEM) throw new Error("no store items");

function setup(coins = 1000) {
  const settings = new Map<string, unknown>();
  const settingsRepo: SettingsRepository = { get: (k) => Promise.resolve(settings.get(k) ?? null), set: (k, v) => (settings.set(k, v), Promise.resolve()) };
  const audit: string[] = [];
  const admin = {
    require: (actor: string) => (actor === "boss" ? Promise.resolve("admin") : Promise.reject(new Error("Admin access required."))),
    record: (_a: string, action: string) => (audit.push(action), Promise.resolve()),
  } as unknown as AdminService;
  const subs = { firstSolves: () => Promise.resolve([]) } as unknown as ChallengeSubmissionRepository;
  const repo = new MemoryStore();
  const store = new StoreService(repo, subs, { get: () => undefined } as unknown as ChallengeCatalog, { prizes: () => Promise.resolve(new Map([["u1", coins], ["u2", coins]])) });
  store.setAdminTools({ admin, settings: settingsRepo });
  return { store, repo, settings, audit };
}

describe("store administration", () => {
  it("only admins see or change the admin view", async () => {
    const { store } = setup();
    await expect(store.adminItems("u1")).rejects.toThrow(/Admin/);
    await expect(store.setItem("u1", ITEM.id, { price: 1, retired: false })).rejects.toThrow(/Admin/);
  });

  it("a new price is what learners pay, and returning to the base price removes the override", async () => {
    const { store, repo, settings, audit } = setup();
    await store.setItem("boss", ITEM.id, { price: 7, retired: false });
    expect((await store.view("u1")).items.find((i) => i.id === ITEM.id)?.price).toBe(7);
    await store.buy("u1", ITEM.id);
    expect(repo.rows.find((r) => r.itemId === ITEM.id)?.price).toBe(7);
    await store.setItem("boss", ITEM.id, { price: ITEM.price, retired: false });
    expect(settings.get("store-overrides")).toEqual({});
    expect(audit).toEqual(["store.update", "store.update"]);
  });

  it("retired items leave the shop and can't be bought, but owners keep and see them", async () => {
    const { store } = setup();
    await store.buy("u1", ITEM.id);
    await store.setItem("boss", ITEM.id, { price: ITEM.price, retired: true });
    expect((await store.view(null)).items.some((i) => i.id === ITEM.id)).toBe(false);
    expect((await store.view("u2")).items.some((i) => i.id === ITEM.id)).toBe(false);
    expect((await store.view("u1")).items.find((i) => i.id === ITEM.id)).toMatchObject({ owned: true });
    await expect(store.buy("u2", ITEM.id)).rejects.toThrow(/no longer for sale/);
    const admin = (await store.adminItems("boss")).find((i) => i.id === ITEM.id);
    expect(admin).toMatchObject({ retired: true, owners: 1, basePrice: ITEM.price });
  });

  it("rejects unknown items and bad prices", async () => {
    const { store } = setup();
    await expect(store.setItem("boss", "nope", { price: 1, retired: false })).rejects.toThrow(/No such item/);
    await expect(store.setItem("boss", ITEM.id, { price: -1, retired: false })).rejects.toThrow(/whole number/);
    await expect(store.setItem("boss", ITEM.id, { price: 1.5, retired: false })).rejects.toThrow(/whole number/);
  });
});
