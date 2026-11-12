import { describe, expect, it } from "vitest";
import type { AdminRepository, AdminUserRow, StaffRole } from "../src/repositories/admin.repository.ts";
import { AdminService } from "../src/services/admin/admin.service.ts";
import { fixedClock } from "./fakes.ts";

class MemoryAdmin implements AdminRepository {
  roles = new Map<string, Set<StaffRole>>();
  profiles = new Set(["owner", "alice", "bob", "carol"]);
  rolesOf(userId: string) {
    return Promise.resolve([...(this.roles.get(userId) ?? [])]);
  }
  grant(userId: string, role: StaffRole) {
    this.roles.set(userId, new Set([...(this.roles.get(userId) ?? []), role]));
    return Promise.resolve();
  }
  revoke(userId: string, role: StaffRole) {
    return Promise.resolve(this.roles.get(userId)?.delete(role) ?? false);
  }
  overview() {
    return Promise.resolve({ learners: 4, connectedOrgs: 1, submissions: 0, submissions24h: 0, byStatus: {} });
  }
  users() {
    return Promise.resolve([...this.profiles].map((id): AdminUserRow => ({ userId: id, handle: id, displayName: id, joined: new Date(0), roles: [...(this.roles.get(id) ?? [])] })));
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
    await expect(service.grant("alice", "bob", "moderator")).rejects.toMatchObject({ status: 403 });
  });

  it("only the owner grants or revokes admin", async () => {
    const { service } = setup();
    await service.grant("owner", "alice", "admin");
    expect(await service.standing("alice")).toBe("admin");
    await expect(service.grant("alice", "bob", "admin")).rejects.toMatchObject({ status: 403 });
    await expect(service.revoke("alice", "alice", "admin")).rejects.toMatchObject({ status: 403 });
  });

  it("admins manage moderators; moderators can view but not grant", async () => {
    const { service } = setup();
    await service.grant("owner", "alice", "admin");
    await service.grant("alice", "bob", "moderator");
    expect(await service.standing("bob")).toBe("moderator");
    await expect(service.overview("bob")).resolves.toMatchObject({ learners: 4 });
    await expect(service.grant("bob", "carol", "moderator")).rejects.toMatchObject({ status: 403 });
    await service.revoke("alice", "bob", "moderator");
    expect(await service.standing("bob")).toBeNull();
  });

  it("the owner is config: can't be granted to, and is flagged in the user list", async () => {
    const { service } = setup();
    await expect(service.grant("owner", "owner", "admin")).rejects.toMatchObject({ status: 409 });
    const users = await service.users("owner", "");
    expect(users.find((u) => u.userId === "owner")?.owner).toBe(true);
  });

  it("rejects unknown users and revoking a role that isn't held", async () => {
    const { service } = setup();
    await expect(service.grant("owner", "nobody", "moderator")).rejects.toMatchObject({ status: 404 });
    await expect(service.revoke("owner", "carol", "moderator")).rejects.toMatchObject({ status: 404 });
  });

  it("without an owner configured, nobody is staff until granted", async () => {
    const repo = new MemoryAdmin();
    const service = new AdminService(repo, undefined, fixedClock());
    expect(await service.standing("owner")).toBeNull();
  });
});
