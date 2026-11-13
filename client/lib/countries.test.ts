import { test } from "node:test";
import assert from "node:assert/strict";
import { countryFlag, countryName } from "./countries";

void test("flags and names come from the two-letter code", () => {
  assert.equal(countryFlag("IN"), "🇮🇳");
  assert.equal(countryFlag("DE"), "🇩🇪");
  assert.equal(countryName("IN"), "India");
});
