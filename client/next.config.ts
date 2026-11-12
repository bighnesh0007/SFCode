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
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
};

export default nextConfig;
