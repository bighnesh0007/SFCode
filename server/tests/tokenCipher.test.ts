import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "../src/lib/crypto/tokenCipher.ts";

const key = randomBytes(32).toString("hex");

describe("tokenCipher", () => {
  it("round-trips and never stores plaintext", () => {
    const enc = encryptToken("00Dxx!secret", key);
    expect(enc).not.toContain("secret");
    expect(decryptToken(enc, key)).toBe("00Dxx!secret");
  });

  it("rejects an unencrypted value instead of passing it through", () => {
    expect(() => decryptToken("plain-token", key)).toThrow(/not encrypted/);
  });

  it("rejects tampering and the wrong key", () => {
    const enc = encryptToken("token", key);
    const tampered = enc.slice(0, -2) + (enc.endsWith("A") ? "BB" : "AA");
    expect(() => decryptToken(tampered, key)).toThrow();
    expect(() => decryptToken(enc, randomBytes(32).toString("hex"))).toThrow();
  });
});
