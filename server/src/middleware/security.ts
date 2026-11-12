/**
 * Security middleware: headers and CORS. Input is guarded by strict zod schemas
 * (see middleware/validate.ts), not by mutating the request.
 */
import cors, { type CorsOptions } from "cors";
import helmetImport from "helmet";
import type { HelmetOptions } from "helmet";
import type { RequestHandler } from "express";
import { config } from "../config/index.ts";
import { interopDefault } from "../lib/interop.ts";

/**
 * helmet ships both CJS and ESM declarations, and resolvers disagree about which to
 * use — under the CJS one a default import types as the module namespace and is not
 * callable. Normalise it and state the factory type explicitly. See lib/interop.ts.
 */
type HelmetFactory = (options?: Readonly<HelmetOptions>) => RequestHandler;
const helmet = interopDefault<HelmetFactory>(helmetImport);

/** Headers suitable for a JSON-only API. */
export function securityHeaders(): RequestHandler {
  return helmet({
    // No HTML is served, so a CSP would only add risk of breaking clients.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "no-referrer" },
  });
}

/**
 * CORS for `/api/v1`: an explicit allowlist, credentials disabled because auth
 * travels as a bearer token rather than a cookie.
 */
export function v1Cors(): RequestHandler {
  const allowed = new Set(config.http.corsAllowedOrigins);

  const options: CorsOptions = {
    origin(origin, callback) {
      // Same-origin/server-to-server requests send no Origin header; allow them.
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, allowed.has(origin));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id", "Idempotency-Key"],
    exposedHeaders: ["X-Request-Id", "RateLimit", "RateLimit-Policy", "Retry-After"],
    credentials: false,
    maxAge: 600,
  };

  return cors(options);
}
