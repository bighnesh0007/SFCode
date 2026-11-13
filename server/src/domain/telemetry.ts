/**
 * Error grouping and the privacy rules for what we store. Pure functions, so
 * the rules are tested without a database.
 */
import { createHash } from "node:crypto";

export const MAX_MESSAGE = 500;
export const MAX_STACK = 4000;
export const MAX_PATH = 120;
export const MAX_USERS_PER_ERROR = 50;

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
// A query string or fragment inside a URL: cut from ? or # to the next space, quote or bracket.
const URL_QUERY = /([a-z]+:\/\/[^\s?#"')]*)[?#][^\s"')]*/gi;
// Long hex or base64-ish runs: session ids, tokens, Salesforce ids.
const TOKENISH = /\b[A-Za-z0-9_-]{24,}\b/g;

/** Removes things that could identify a person or leak a secret. */
export function scrub(text: string): string {
  return text.replace(URL_QUERY, "$1").replace(EMAIL, "[email]").replace(TOKENISH, "[token]");
}

export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** A page path safe to store: no query or fragment, no API paths, bounded length; null to drop it. */
export function cleanPath(raw: string): string | null {
  const path = raw.split(/[?#]/)[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("//") || /^\/(api|backend|_next)(\/|$)/.test(path)) return null;
  if (path.length > MAX_PATH || !/^[\w\-/.~%]*$/.test(path)) return null;
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/** The parts of a message that vary between occurrences of the same bug. */
function normaliseMessage(message: string): string {
  return message
    .replace(/(["'`]).*?\1/g, "$1…$1")
    .replace(/\b0x[0-9a-f]+\b/gi, "N")
    .replace(/\d+/g, "N");
}

/** The first stack frame, without line/column numbers or build hashes, which change on every deploy. */
function topFrame(stack: string | null): string {
  const line = (stack ?? "").split("\n").find((l) => /\bat\b|@/.test(l)) ?? "";
  return line
    .trim()
    .replace(/:\d+(:\d+)?\)?$/, "")
    .replace(/[._-][0-9a-f]{6,}(?=\.\w+)/gi, "")
    .replace(/\?[^\s)]*/g, "");
}

/** Same bug, same fingerprint: across users, deploys and the varying details in its message. */
export function fingerprint(source: string, name: string, message: string, stack: string | null): string {
  return createHash("sha256").update(`${source}\n${name}\n${normaliseMessage(message)}\n${topFrame(stack)}`).digest("hex").slice(0, 32);
}
