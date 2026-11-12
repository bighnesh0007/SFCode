/** RFC 7636 PKCE pair with the S256 method — the only one Salesforce should be offered. */
import { createHash, randomBytes } from "node:crypto";

export function createPkcePair(): { verifier: string; challenge: string } {
  // 32 random bytes → 43 base64url chars, the RFC's minimum length.
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
