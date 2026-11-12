import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk session handling only. Pages that need a user check `auth()` themselves
 * (DWCode's route-matcher approach is deprecated by Clerk for path-matching
 * bypass reasons), and every API action is authorised again on the server.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
