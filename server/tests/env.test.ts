import { describe, expect, it } from "vitest";
import { parseEnv, resolveCapabilities } from "../src/config/env.ts";

describe("parseEnv", () => {
  it("treats `KEY=` (as left by .env.example) as unset, not invalid", () => {
    const env = parseEnv({ CLERK_SECRET_KEY: "", SF_CLIENT_ID: "", TOKEN_ENCRYPTION_KEY: "" });
    expect(env.CLERK_SECRET_KEY).toBeUndefined();
    expect(resolveCapabilities(env).enabled).toEqual([]);
  });

  it("still rejects a present but malformed value", () => {
    expect(() => parseEnv({ TOKEN_ENCRYPTION_KEY: "short" })).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });
});
