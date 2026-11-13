/**
 * Process entry point: report configuration, build the app, listen, and shut
 * down gracefully on SIGTERM/SIGINT.
 */
import { buildApp } from "./app.ts";
import { buildContainer } from "./container.ts";
import { capabilities, config } from "./config/index.ts";
import { logger } from "./lib/logger.ts";

logger.info({ enabled: capabilities.enabled }, "capabilities enabled");
for (const { capability, vars } of capabilities.missing) {
  logger.warn({ capability, missing: vars }, `capability "${capability}" is disabled: missing env vars`);
}

const container = buildContainer();
// Community problems live in the database; add them to the catalog before serving.
if (container.drafts) {
  const n = await container.drafts.loadPublished().catch((err: unknown) => {
    logger.error({ err }, "loading community problems failed; serving built-in problems only");
    return 0;
  });
  logger.info({ count: n }, "community problems loaded");
}
const app = buildApp(container);

// Weekly digest: check hourly (it only sends on Mondays from 09:00 UTC, once per user per week).
if (container.digest?.enabled) {
  const digest = container.digest;
  const run = () => void digest.runWeekly().catch((err: unknown) => logger.error({ err }, "weekly digest run failed"));
  setTimeout(run, 60_000).unref();
  setInterval(run, 60 * 60_000).unref();
}

const server = app.listen(config.port, config.host, () => {
  logger.info({ port: config.port }, `SFCode server listening on http://${config.host}:${config.port}`);
});

// Slowloris protection; Node's defaults are generous. Apex can run ~minute-long,
// so the request timeout sits above SF_TIMEOUT_MS.
server.headersTimeout = 65_000;
server.requestTimeout = 125_000;

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");
  server.close((err) => {
    if (err) logger.error({ err }, "error while closing HTTP server");
    void (container.db?.close() ?? Promise.resolve()).finally(() => process.exit(err ? 1 : 0));
  });
  setTimeout(() => {
    logger.warn("forcing shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => logger.error({ err: reason }, "unhandled promise rejection"));
