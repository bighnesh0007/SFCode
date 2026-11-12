/**
 * Public-facing identity from Clerk: username, name and avatar. Never the
 * email address. Used once, to seed a profile.
 */
import { createClerkClient } from "@clerk/backend";

export interface PublicIdentity {
  username: string | null;
  displayName: string | null;
  imageUrl: string | null;
}

export interface IdentityLookup {
  lookup(userId: string): Promise<PublicIdentity>;
}

export class ClerkIdentityLookup implements IdentityLookup {
  private readonly clerk;

  constructor(secretKey: string) {
    this.clerk = createClerkClient({ secretKey });
  }

  async lookup(userId: string): Promise<PublicIdentity> {
    try {
      const u = await this.clerk.users.getUser(userId);
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
      return { username: u.username ?? null, displayName: name || null, imageUrl: u.imageUrl || null };
    } catch {
      // Clerk unreachable: the profile still gets created with neutral defaults.
      return { username: null, displayName: null, imageUrl: null };
    }
  }
}
