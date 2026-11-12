/**
 * Builds the Express application. NEVER calls `listen()` — that belongs to
 * server.ts, which is what lets supertest drive the app without binding a port.
 */
import express, { type Application } from "express";
import compression from "compression";
import { config } from "./config/index.ts";
import type { Container } from "./container.ts";
import { errorHandler } from "./middleware/errorHandler.ts";
import { requestContext } from "./middleware/requestContext.ts";
import { securityHeaders } from "./middleware/security.ts";
import { mountRoutes } from "./routes/index.ts";

export function buildApp(container: Container): Application {
  const app = express();

  if (config.http.trustProxy === "loopback") app.set("trust proxy", "loopback");
  else if (config.http.trustProxy) app.set("trust proxy", 1);

  app.disable("x-powered-by");
  // `?a[b]=c` should not become a nested object we then have to reason about.
  app.set("query parser", "simple");

  app.use(securityHeaders());
  app.use(compression());
  app.use(requestContext);

  mountRoutes(app, container);

  // Must be last.
  app.use(errorHandler);

  return app;
}
