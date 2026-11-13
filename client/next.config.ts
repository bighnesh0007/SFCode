import path from "node:path";
import type { NextConfig } from "next";

// The workspace root is the repo root (one lockfile there), not client/.
const workspaceRoot = path.join(import.meta.dirname, "..");

/**
 * One public origin: the browser calls `/backend/*` on this site and Next.js
 * proxies it to the Express server, so the API needs no public address and no
 * CORS. The Salesforce OAuth callback also arrives through this proxy.
 */
const backendInternalUrl = (process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:4100").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  rewrites() {
    return Promise.resolve([{ source: "/backend/:path*", destination: `${backendInternalUrl}/:path*` }]);
  },
  // From the Next.js PWA guide: the service worker must never be served stale.
  headers() {
    return Promise.resolve([
      {
        // Baseline hardening for every page. No CSP yet: Clerk, Monaco and the LWC
        // preview need a tested policy, and a wrong one breaks sign-in silently.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]);
  },
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
};

export default nextConfig;
