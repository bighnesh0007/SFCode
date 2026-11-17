import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KNOWN_STYLES } from "../components/Cosmetics";

// The server catalogue is the source of truth for items; every style it sells must be drawable here.
void test("every store item's style has a visual on the client", () => {
  const src = readFileSync(new URL("../../server/src/domain/store.ts", import.meta.url), "utf8");
  const items = [...src.matchAll(/slot: "(\w+)",[^}]*?style: "(\w+)"/g)].map((m) => ({ slot: m[1] ?? "", style: m[2] ?? "" }));
  assert.ok(items.length >= 30, `parsed ${items.length} items`);
  const missing = items.filter((i) => i.slot !== "editor" && !(KNOWN_STYLES[i.slot] ?? []).includes(i.style));
  assert.deepEqual(missing, []);
});
