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

  /** The user's primary, verified email address (for opt-in emails only), or null. */
  async email(userId: string): Promise<string | null> {
    try {
      const u = await this.clerk.users.getUser(userId);
      const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId);
      return primary && primary.verification?.status === "verified" ? primary.emailAddress : null;
    } catch {
      return null;
    }
  }

  async ban(userId: string): Promise<void> {
    await this.clerk.users.banUser(userId);
  }

  async unban(userId: string): Promise<void> {
    await this.clerk.users.unbanUser(userId);
  }

  /** null when Clerk can't be reached: the admin page shows "unknown" rather than a guess. */
  async isBanned(userId: string): Promise<boolean | null> {
    try {
      return (await this.clerk.users.getUser(userId)).banned;
    } catch {
      return null;
    }
  }
}
