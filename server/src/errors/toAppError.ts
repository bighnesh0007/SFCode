/**
 * Normalises anything thrown anywhere into an `AppError`.
 *
 * Third-party error shapes are detected by duck-typing rather than by importing
 * pg/body-parser here, which keeps `errors/` a dependency-free leaf layer.
 */
import { ZodError } from "zod";
import {
  AppError,
  BadRequestError,
  ConflictError,
  InternalError,
  PayloadTooLargeError,
  UpstreamError,
  ValidationError,
} from "./AppError.ts";
import { ErrorCode } from "./codes.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Flatten a ZodError into `{ path, message, code }` triples for the client. */
export function zodIssues(error: ZodError): {
  path: string;
  message: string;
  code: string;
}[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
    code: issue.code,
  }));
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  // ── zod ────────────────────────────────────────────────────────────────────
  if (err instanceof ZodError) {
    return new ValidationError("Request validation failed.", zodIssues(err));
  }

  if (!isRecord(err)) {
    return new InternalError("Internal server error.", err);
  }

  const name = typeof err.name === "string" ? err.name : "";
  const message = typeof err.message === "string" ? err.message : "";
  const code = err.code;

  // ── AbortController / fetch timeouts ───────────────────────────────────────
  if (name === "AbortError" || name === "TimeoutError") {
    return new UpstreamError("Upstream request timed out.", { timeout: true, cause: err });
  }

  // ── PostgreSQL unique violation ───────────────────────────────────────────
  if (code === "23505") {
    return new ConflictError("That record already exists.", ErrorCode.ALREADY_EXISTS);
  }
  if (code === "ECONNREFUSED" || code === "57P01") {
    return new UpstreamError("Database unavailable.", { expose: false, cause: err });
  }

  // ── body-parser / raw-body ─────────────────────────────────────────────────
  if (code === "ENTITY_TOO_LARGE" || err.type === "entity.too.large") {
    return new PayloadTooLargeError();
  }
  if (
    code === "ENTITY_PARSE_FAILED" ||
    err.type === "entity.parse.failed" ||
    (name === "SyntaxError" && "body" in err)
  ) {
    return new BadRequestError("Request body is not valid JSON.");
  }
  if (err.type === "encoding.unsupported" || err.type === "charset.unsupported") {
    return new BadRequestError("Unsupported request encoding.");
  }

  // ── Unknown ────────────────────────────────────────────────────────────────
  return new InternalError(message || "Internal server error.", err);
}
