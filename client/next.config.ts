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

/**
 * Content-Security-Policy, built from what the site really loads: Clerk (its
 * own domain, Cloudflare's bot-check frame, its image host), Monaco from
 * jsDelivr, and Cloudflare's analytics beacon. 'unsafe-inline' is needed for
 * Next's inline bootstrap scripts; per-request nonces would turn off the static
 * and cached pages. Sent report-only first (CSP_ENFORCE unset): browsers report
 * what would be blocked to /backend/api/v1/telemetry/csp and nothing breaks.
 */
const CLERK = "https://clerk.bighnesh.space";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${CLERK} https://challenges.cloudflare.com https://cdn.jsdelivr.net https://static.cloudflareinsights.com`,
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https://img.clerk.com",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  `connect-src 'self' ${CLERK} https://cdn.jsdelivr.net https://cloudflareinsights.com`,
  "frame-src 'self' https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "report-uri /backend/api/v1/telemetry/csp",
].join("; ");
const cspHeader = process.env.CSP_ENFORCE === "true" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";

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
          { key: cspHeader, value: csp },
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
