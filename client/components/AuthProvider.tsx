import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

/** ClerkProvider only when Clerk is configured; see components/auth.tsx. */
export function AuthProvider({ children }: { children: ReactNode }) {
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <ClerkProvider>{children}</ClerkProvider> : <>{children}</>;
}
