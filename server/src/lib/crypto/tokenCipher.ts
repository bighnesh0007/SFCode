/**
 * AES-256-GCM encryption for third-party access tokens at rest.
 *
 * Stored form: `enc:v1:<iv b64url>:<tag b64url>:<ciphertext b64url>`. `v1`
 * leaves room to rotate the scheme or key later. Unlike DWCode there is no
 * legacy plaintext to tolerate, so an unprefixed value is an error, not a token.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const ENCRYPTED_PREFIX = "enc:v1:";

function keyBuffer(hexKey: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error("Token encryption key must be 64 hex characters (32 bytes).");
  }
  return Buffer.from(hexKey, "hex");
}

export function isEncryptedToken(stored: string): boolean {
  return stored.startsWith(ENCRYPTED_PREFIX);
}

export function encryptToken(plaintext: string, hexKey: string): string {
  const iv = randomBytes(12); // 96-bit nonce, the GCM standard; never reused per key
  const cipher = createCipheriv("aes-256-gcm", keyBuffer(hexKey), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

/**
 * Decrypt a stored token. Throws if it is not in the encrypted form, or if an encrypted value was tampered with or the key is wrong — GCM's
 * tag check fails rather than yielding garbage.
 */
export function decryptToken(stored: string, hexKey: string | undefined): string {
  if (!isEncryptedToken(stored)) throw new Error("Stored token is not encrypted.");
  if (!hexKey) throw new Error("Token is encrypted but no encryption key is configured.");
  const [ivPart, tagPart, dataPart] = stored.slice(ENCRYPTED_PREFIX.length).split(":");
  if (ivPart === undefined || tagPart === undefined || dataPart === undefined) {
    throw new Error("Malformed encrypted token.");
  }
  const decipher = createDecipheriv("aes-256-gcm", keyBuffer(hexKey), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
}
