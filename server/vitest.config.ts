import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    // config/ parses env at import; pin a known, minimal environment for every suite.
    env: { NODE_ENV: "test", LOG_LEVEL: "silent" },
  },
});
