import express, { Router, type Application, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { hasCapability } from "../config/index.ts";
import type { Container } from "../container.ts";
import { salesforceController } from "../controllers/salesforce.controller.ts";
import { NotConfiguredError, RateLimitError } from "../errors/AppError.ts";
import { requireAuth } from "../middleware/auth.ts";
import { notFound } from "../middleware/notFound.ts";
import { v1Cors } from "../middleware/security.ts";
import { validate } from "../middleware/validate.ts";
import { ok } from "../utils/respond.ts";
import { callbackQuery, connectBody, executeBody } from "../validation/salesforce.schema.ts";

function disabled(what: string): RequestHandler {
  return (_req, _res, next) => next(new NotConfiguredError(what));
}

/** Per-user (falling back to per-IP) limit; in-memory, so correct for one instance only. */
function limiter(perMinute: number): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: perMinute,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => req.auth?.userId ?? req.ip ?? "unknown",
    handler: (_req, _res, next) => next(new RateLimitError("Too many requests.", 60)),
  });
}

export function mountRoutes(app: Application, container: Container): void {
  app.get("/health", (_req, res) => ok(res, { status: "ok" }));

  const v1 = Router();
  v1.use(v1Cors());
  v1.use(express.json({ limit: "256kb" }));

  const sf = Router();
  const { verifier, salesforce } = container;
  if (!verifier) {
    sf.use(disabled("Sign-in"));
  } else if (!salesforce || !hasCapability("salesforce")) {
    sf.use(disabled("Salesforce org connection"));
  } else {
    const c = salesforceController(salesforce);
    // The callback is a browser navigation from Salesforce; it is authenticated by
    // the signed state + single-use PKCE row, not by a Clerk session.
    sf.get("/oauth/callback", limiter(30), validate({ query: callbackQuery }), c.callback);
    sf.use(requireAuth(verifier));
    sf.post("/connect", limiter(10), validate({ body: connectBody }), c.start);
    sf.get("/connection", c.status);
    sf.delete("/connection", c.disconnect);
    sf.post("/apex/execute", limiter(20), validate({ body: executeBody }), c.execute);
  }
  v1.use("/salesforce", sf);

  app.use("/api/v1", v1);
  app.use(notFound);
}
