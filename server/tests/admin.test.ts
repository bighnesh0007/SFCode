import { describe, expect, it } from "vitest";
import type { AdminRepository, AdminUserRow, AuditRow, Dashboard, StaffRole, StoredRole, UserDetail } from "../src/repositories/admin.repository.ts";
import type { SettingsRepository } from "../src/repositories/settings.repository.ts";
import { AdminService, type AccountModeration } from "../src/services/admin/admin.service.ts";
import { fixedClock } from "./fakes.ts";

class MemoryAdmin implements AdminRepository {
  roles = new Map<string, Set<StoredRole>>();
  profiles = new Set(["owner", "alice", "bob", "carol", "dave", "erin"]);
  countRole(role: StaffRole) {
    return Promise.resolve([...this.roles.values()].filter((r) => r.has(role)).length);
  }
  rolesOf(userId: string) {
    return Promise.resolve([...(this.roles.get(userId) ?? [])]);
  }
  grant(userId: string, role: StoredRole) {
    this.roles.set(userId, new Set([...(this.roles.get(userId) ?? []), role]));
    return Promise.resolve();
  }
  revoke(userId: string, role: StoredRole) {
    return Promise.resolve(this.roles.get(userId)?.delete(role) ?? false);
  }
  overview() {
    return Promise.resolve({ learners: 6, connectedOrgs: 1, submissions: 0, submissions24h: 0, byStatus: {} });
  }
  users() {
    return Promise.resolve([...this.profiles].map((id): AdminUserRow => ({ userId: id, handle: id, displayName: id, joined: new Date(0), roles: [...(this.roles.get(id) ?? [])].map((r) => (r === "moderator" ? "reviewer" : r)) })));
  }
  profileExists(userId: string) {
    return Promise.resolve(this.profiles.has(userId));
  }
  stats: Dashboard = { days: [], problems: [] };
  dashboard() {
    return Promise.resolve(this.stats);
  }
  userDetail(userId: string): Promise<UserDetail | null> {
    if (!this.profiles.has(userId)) return Promise.resolve(null);
    return Promise.resolve({
      userId, handle: userId, displayName: userId, imageUrl: null, joined: new Date(0), roles: [], submissions: 2, accepted: 1, solved: 1,
      lastActive: new Date(1000), certAnswers: 0, org: null, recent: [{ slug: "apex-one", status: "accepted", at: new Date(1000) }],
    });
  }
  log: AuditRow[] = [];
  failAudit = false;
  audit(e: { actorId: string; action: string; targetId?: string | null; detail?: Record<string, unknown> }) {
    if (this.failAudit) return Promise.reject(new Error("db down"));
    this.log.unshift({ id: String(this.log.length), actorId: e.actorId, action: e.action, targetId: e.targetId ?? null, detail: e.detail ?? {}, at: new Date(0) });
    return Promise.resolve();
  }
  auditLog(limit: number) {
    return Promise.resolve(this.log.slice(0, limit));
  }
}

class MemorySettings implements SettingsRepository {
  values = new Map<string, unknown>();
  get(key: string) {
    return Promise.resolve(this.values.get(key) ?? null);
  }
  set(key: string, value: unknown) {
    this.values.set(key, value);
    return Promise.resolve();
  }
}

class FakeModeration implements AccountModeration {
  banned = new Set<string>();
  ban(id: string) {
    this.banned.add(id);
    return Promise.resolve();
  }
  unban(id: string) {
    this.banned.delete(id);
    return Promise.resolve();
  }
  isBanned(id: string) {
    return Promise.resolve(this.banned.has(id));
  }
}

function fullSetup() {
  const repo = new MemoryAdmin();
  const settings = new MemorySettings();
  const moderation = new FakeModeration();
  const service = new AdminService(repo, "owner", fixedClock(), settings, moderation);
  return { repo, settings, moderation, service };
}

function setup() {
  const repo = new MemoryAdmin();
  return { repo, service: new AdminService(repo, "owner", fixedClock()) };
}

describe("AdminService authorisation", () => {
  it("refuses everything to non-staff", async () => {
    const { service } = setup();
    await expect(service.overview("alice")).rejects.toMatchObject({ status: 403 });
    await expect(service.users("alice", "")).rejects.toMatchObject({ status: 403 });
    await expect(service.grant("alice", "bob", "reviewer")).rejects.toMatchObject({ status: 403 });
  });

  it("only the owner grants or revokes admin", async () => {
    const { service } = setup();
    await service.grant("owner", "alice", "admin");
    expect(await service.standing("alice")).toBe("admin");
    await expect(service.grant("alice", "bob", "admin")).rejects.toMatchObject({ status: 403 });
    await expect(service.revoke("alice", "alice", "admin")).rejects.toMatchObject({ status: 403 });
  });

  it("admins manage reviewers; reviewers manage buddies; buddies grant nothing", async () => {
    const { service } = setup();
    await service.grant("owner", "alice", "admin");
    await service.grant("alice", "bob", "reviewer");
    expect(await service.standing("bob")).toBe("reviewer");
    await expect(service.overview("bob")).resolves.toMatchObject({ learners: 6 });
    await expect(service.grant("bob", "carol", "reviewer")).rejects.toMatchObject({ status: 403 });
    await service.grant("bob", "carol", "buddy");
    expect(await service.standing("carol")).toBe("buddy");
    await expect(service.overview("carol")).rejects.toMatchObject({ status: 403 });
    await expect(service.grant("carol", "dave", "buddy")).rejects.toMatchObject({ status: 403 });
    await service.revoke("bob", "carol", "buddy");
    expect(await service.standing("carol")).toBeNull();
    await service.revoke("alice", "bob", "reviewer");
    expect(await service.standing("bob")).toBeNull();
  });

  it("at most two admins; re-granting an existing admin is fine", async () => {
    const { service } = setup();
    await service.grant("owner", "alice", "admin");
    await service.grant("owner", "bob", "admin");
    await service.grant("owner", "bob", "admin");
    await expect(service.grant("owner", "carol", "admin")).rejects.toMatchObject({ status: 409 });
    await service.revoke("owner", "bob", "admin");
    await service.grant("owner", "carol", "admin");
    expect(await service.standing("carol")).toBe("admin");
  });

  it("pre-rename moderator rows act as reviewer and are removed by revoking reviewer", async () => {
    const { repo, service } = setup();
    await repo.grant("dave", "moderator");
    expect(await service.standing("dave")).toBe("reviewer");
    expect((await service.users("owner", "")).find((u) => u.userId === "dave")?.roles).toEqual(["reviewer"]);
    await service.revoke("owner", "dave", "reviewer");
    expect(await service.standing("dave")).toBeNull();
  });

  it("the owner is config: can't be granted to, and is flagged in the user list", async () => {
    const { service } = setup();
    await expect(service.grant("owner", "owner", "admin")).rejects.toMatchObject({ status: 409 });
    const users = await service.users("owner", "");
    expect(users.find((u) => u.userId === "owner")?.owner).toBe(true);
  });

  it("rejects unknown users and revoking a role that isn't held", async () => {
    const { service } = setup();
    await expect(service.grant("owner", "nobody", "reviewer")).rejects.toMatchObject({ status: 404 });
    await expect(service.revoke("owner", "carol", "reviewer")).rejects.toMatchObject({ status: 404 });
  });

  it("without an owner configured, nobody is staff until granted", async () => {
    const repo = new MemoryAdmin();
    const service = new AdminService(repo, undefined, fixedClock());
    expect(await service.standing("owner")).toBeNull();
  });
});

describe("admin tools", () => {
  it("audits role changes, and only admins read the audit log", async () => {
    const { repo, service } = fullSetup();
    await service.grant("owner", "alice", "admin");
    await service.grant("alice", "bob", "reviewer");
    await service.revoke("alice", "bob", "reviewer");
    expect(repo.log.map((r) => [r.actorId, r.action, r.targetId, r.detail])).toEqual([
      ["alice", "role.revoke", "bob", { role: "reviewer" }],
      ["alice", "role.grant", "bob", { role: "reviewer" }],
      ["owner", "role.grant", "alice", { role: "admin" }],
    ]);
    await service.grant("alice", "carol", "reviewer");
    await expect(service.auditLog("carol")).rejects.toThrow(/Admin access/);
    expect(await service.auditLog("alice")).toHaveLength(4);
  });

  it("a failed audit write doesn't undo the action", async () => {
    const { repo, service } = fullSetup();
    repo.failAudit = true;
    await service.grant("owner", "alice", "admin");
    expect(await repo.rolesOf("alice")).toEqual(["admin"]);
  });

  it("suspend: admins only; never yourself or the owner; only the owner suspends an admin; audited", async () => {
    const { repo, moderation, service } = fullSetup();
    await service.grant("owner", "alice", "admin");
    await service.grant("owner", "bob", "admin");
    await service.grant("alice", "carol", "reviewer");
    await expect(service.setSuspended("carol", "dave", true, "")).rejects.toThrow(/Admin access/);
    await expect(service.setSuspended("alice", "alice", true, "")).rejects.toThrow(/yourself/);
    await expect(service.setSuspended("alice", "owner", true, "")).rejects.toThrow(/owner/);
    await expect(service.setSuspended("alice", "bob", true, "")).rejects.toThrow(/Only the owner/);
    await expect(service.setSuspended("alice", "nobody", true, "")).rejects.toThrow(/No learner/);
    expect(moderation.banned.size).toBe(0);

    await service.setSuspended("alice", "dave", true, "spam");
    expect((await service.user("carol", "dave")).suspended).toBe(true);
    await service.setSuspended("owner", "bob", true, "");
    await service.setSuspended("alice", "dave", false, "");
    expect([...moderation.banned]).toEqual(["bob"]);
    expect(repo.log.slice(0, 3).map((r) => [r.action, r.targetId])).toEqual([["user.restore", "dave"], ["user.suspend", "bob"], ["user.suspend", "dave"]]);
    expect(repo.log[2]?.detail).toEqual({ reason: "spam" });
  });

  it("user detail is for reviewers and up, with titles and ISO dates", async () => {
    const { service } = fullSetup();
    service.setProblemTitles((slug) => (slug === "apex-one" ? "Apex One" : undefined));
    await service.grant("owner", "alice", "admin");
    await service.grant("alice", "carol", "reviewer");
    await expect(service.user("dave", "erin")).rejects.toThrow(/Admin access/);
    const u = await service.user("carol", "erin");
    expect(u).toMatchObject({ handle: "erin", owner: false, suspended: false, lastActive: new Date(1000).toISOString() });
    expect(u.recent[0]).toMatchObject({ title: "Apex One", status: "accepted" });
    expect((await service.user("carol", "owner")).owner).toBe(true);
    await expect(service.user("carol", "nobody")).rejects.toThrow(/No learner/);
  });

  it("dashboard: top by volume; hardest by acceptance rate, only with enough attempts", async () => {
    const { repo, service } = fullSetup();
    await service.grant("owner", "alice", "admin");
    repo.stats = {
      days: [],
      problems: [
        { slug: "easy", submissions: 10, accepted: 9, solvers: 9 },
        { slug: "hard", submissions: 8, accepted: 1, solvers: 1 },
        { slug: "rare", submissions: 4, accepted: 0, solvers: 0 },
      ],
    };
    const d = await service.dashboard("alice");
    expect(d.top.map((p) => p.slug)).toEqual(["easy", "hard", "rare"]);
    expect(d.hardest.map((p) => [p.slug, p.rate])).toEqual([["hard", 13], ["easy", 90]]);
    expect(d.top.find((p) => p.slug === "rare")?.rate).toBeNull();
  });

  it("announcements: admins set and clear them; anyone reads; each new text gets a new id", async () => {
    const { repo, service } = fullSetup();
    await service.grant("owner", "alice", "admin");
    await service.grant("alice", "carol", "reviewer");
    expect(await service.announcement()).toBeNull();
    await expect(service.setAnnouncement("carol", { text: "hi", tone: "info" })).rejects.toThrow(/Admin access/);
    const a = await service.setAnnouncement("alice", { text: "  Contest on Friday  ", tone: "success" });
    expect(await service.announcement()).toEqual(a);
    expect(a).toMatchObject({ text: "Contest on Friday", tone: "success" });
    await service.setAnnouncement("alice", { text: "   ", tone: "info" });
    expect(await service.announcement()).toBeNull();
    expect(repo.log[0]?.action).toBe("announcement.clear");
  });
});
