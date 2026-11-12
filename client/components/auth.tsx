"use client";

/**
 * The only module that imports Clerk's client components.
 *
 * Contributors must be able to run SFCode without the maintainer's Clerk app,
 * so auth is optional: with no NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY the app runs
 * signed-out ("local mode") — browsing, the playground UI and Certification
 * Prep work; anything needing an account says sign-in isn't configured.
 */
import type { ReactElement, ReactNode } from "react";
import { SignInButton as ClerkSignInButton, SignUpButton as ClerkSignUpButton, UserButton as ClerkUserButton, useAuth } from "@clerk/nextjs";

// Inlined at build time, so the choice below is fixed for the whole bundle.
export const AUTH_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
}

const SIGNED_OUT: AuthState = { isLoaded: true, isSignedIn: false, getToken: () => Promise.resolve(null) };

function useClerkState(): AuthState {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  return { isLoaded, isSignedIn: Boolean(isSignedIn), getToken };
}

function useLocalMode(): AuthState {
  return SIGNED_OUT;
}

/**
 * Picked once at module load from a build-time constant, so every render calls
 * the same hook — the rules of hooks hold.
 */
export const useAuthState: () => AuthState = AUTH_ENABLED ? useClerkState : useLocalMode;

const NOT_CONFIGURED = "Sign-in isn't configured on this server (local mode — see CONTRIBUTING.md).";

/** Wraps a button that opens sign-in. In local mode the button is shown but disabled. */
export function SignInButton({ children }: { children: ReactElement }) {
  if (AUTH_ENABLED) return <ClerkSignInButton mode="modal">{children}</ClerkSignInButton>;
  return (
    <span title={NOT_CONFIGURED} aria-disabled="true" className="pointer-events-none opacity-50">
      {children}
    </span>
  );
}

export function SignUpButton({ children }: { children: ReactElement }) {
  return AUTH_ENABLED ? <ClerkSignUpButton mode="modal">{children}</ClerkSignUpButton> : null;
}

export function UserButton() {
  return AUTH_ENABLED ? <ClerkUserButton /> : null;
}

/** Small marker so nobody mistakes local mode for a broken sign-in. */
export function LocalModeBadge(): ReactNode {
  if (AUTH_ENABLED) return null;
  return (
    <span title={NOT_CONFIGURED} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
      Local mode
    </span>
  );
}
