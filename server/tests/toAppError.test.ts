import { describe, expect, it } from "vitest";
import { toAppError } from "../src/errors/toAppError.ts";

describe("toAppError", () => {
  it("maps a Postgres unique violation to 409, including when Drizzle wraps it in `cause`", () => {
    expect(toAppError({ code: "23505", message: "dup" })).toMatchObject({ status: 409 });
    expect(toAppError({ message: "Failed query", cause: { code: "23505" } })).toMatchObject({ status: 409 });
  });

  it("keeps unknown errors as an unexposed 500", () => {
    expect(toAppError(new Error("boom"))).toMatchObject({ status: 500, expose: false });
  });
});
