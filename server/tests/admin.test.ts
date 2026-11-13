import { describe, expect, it } from "vitest";
import type { AdminRepository, AdminUserRow, StaffRole, StoredRole } from "../src/repositories/admin.repository.ts";
import { AdminService } from "../src/services/admin/admin.service.ts";
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
