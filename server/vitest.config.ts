import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    // config/ parses env at import; pin a known, minimal environment for every suite.
    env: { NODE_ENV: "test", LOG_LEVEL: "silent" },
    // The Postgres suites share one test database and TRUNCATE shared tables
    // (user_profiles…) in setup; run in parallel, one file's cleanup wiped
    // another's data mid-test (an intermittent failure). Serial when a test
    // database is in use; parallel otherwise.
    fileParallelism: !process.env.TEST_DATABASE_URL,
  },
});
