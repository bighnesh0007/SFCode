import { describe, expect, it } from "vitest";
import type { SettingsRepository } from "../src/repositories/settings.repository.ts";
import type { AdminService } from "../src/services/admin/admin.service.ts";
import { DEFAULT_POINTS, PointsService, PointsTable, pointsMatrixSchema } from "../src/services/points/points.service.ts";

class MemorySettings implements SettingsRepository {
  rows = new Map<string, unknown>();
  get(key: string) {
    return Promise.resolve(this.rows.get(key) ?? null);
  }
  set(key: string, value: unknown) {
    this.rows.set(key, value);
    return Promise.resolve();
  }
}
const admins = (who: string[]) => ({ record: () => Promise.resolve(), require: (actor: string) => (who.includes(actor) ? Promise.resolve("admin") : Promise.reject(Object.assign(new Error("no"), { status: 403 }))) }) as unknown as AdminService;

describe("points table", () => {
  it("defaults follow the agreed priority: LWC > Apex > Debugging > Flow > SOQL, scaled by difficulty", () => {
    const t = new PointsTable(DEFAULT_POINTS);
    expect([t.points("lwc", "Hard"), t.points("apex", "Hard"), t.points("flow", "Hard"), t.points("soql", "Hard")]).toEqual([12, 9, 6, 3]);
    expect([t.points("debug", "Easy"), t.points("debug", "Medium"), t.points("debug", "Hard")]).toEqual([2, 6, 9]);
  });

  it("coins: solves before the cutover keep the old value; after, points × coinsPerPoint", () => {
    const t = new PointsTable({ ...DEFAULT_POINTS, cutover: "2026-11-13T00:00:00Z" });
    expect(t.coins("apex", "Medium", new Date("2026-11-12T23:59:59Z"))).toBe(20);
    expect(t.coins("apex", "Medium", new Date("2026-11-13T00:00:01Z"))).toBe(6 * DEFAULT_POINTS.coinsPerPoint);
  });

  it("reads the stored table, falls back to defaults on a missing or broken row", async () => {
    const repo = new MemorySettings();
    expect((await new PointsService(repo, admins([])).table()).points("soql", "Easy")).toBe(1);
    repo.rows.set("points", { matrix: "nonsense" });
    expect((await new PointsService(repo, admins([])).table()).settings).toEqual(DEFAULT_POINTS);
  });

  it("only admins update; the cutover can't be moved; the cache refreshes", async () => {
    const repo = new MemorySettings();
    repo.rows.set("points", { ...DEFAULT_POINTS, cutover: "2026-11-13T00:00:00Z" });
    const svc = new PointsService(repo, admins(["boss"]));
    const matrix = { ...DEFAULT_POINTS.matrix, soql: { Easy: 2, Medium: 3, Hard: 5 } };
    await expect(svc.update("nobody", { matrix, coinsPerPoint: 3 })).rejects.toMatchObject({ status: 403 });
    const saved = await svc.update("boss", { matrix, coinsPerPoint: 4 });
    expect(saved.cutover).toBe("2026-11-13T00:00:00Z");
    expect((await svc.table()).points("soql", "Hard")).toBe(5);
  });

  it("the schema rejects missing tracks, negatives and silly values", () => {
    expect(pointsMatrixSchema.safeParse(DEFAULT_POINTS.matrix).success).toBe(true);
    const noLwc: Record<string, unknown> = { ...DEFAULT_POINTS.matrix };
    delete noLwc.lwc;
    expect(pointsMatrixSchema.safeParse(noLwc).success).toBe(false);
    expect(pointsMatrixSchema.safeParse({ ...DEFAULT_POINTS.matrix, apex: { Easy: -1, Medium: 6, Hard: 9 } }).success).toBe(false);
    expect(pointsMatrixSchema.safeParse({ ...DEFAULT_POINTS.matrix, apex: { Easy: 1.5, Medium: 6, Hard: 9 } }).success).toBe(false);
  });
});
