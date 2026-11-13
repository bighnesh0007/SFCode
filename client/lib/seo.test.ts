import { test } from "node:test";
import assert from "node:assert/strict";
import { clip, pageMeta } from "./seo";

void test("clip strips markdown and cuts at a word under the limit", () => {
  assert.equal(clip("Write the **trigger** `SfcA` on [Account](https://x.y).\n\n```apex\ncode\n```  Done."), "Write the trigger SfcA on Account. Done.");
  const long = clip("word ".repeat(100));
  assert.ok(long.length <= 155, `got ${long.length}`);
  assert.ok(long.endsWith("word…"));
});

void test("pageMeta sets a canonical URL and noindex only when asked", () => {
  const m = pageMeta({ title: "SOQL Practice Problems", description: "d", path: "/soql" });
  assert.equal((m.alternates as { canonical: string }).canonical, "https://sf.bighnesh.space/soql");
  assert.equal(m.robots, undefined);
  assert.deepEqual(pageMeta({ title: "t", description: "d", path: "/admin", noindex: true }).robots, { index: false, follow: true });
});

void test("every page names its own share image, built from its title", () => {
  const m = pageMeta({ title: "Triggers", description: "d", path: "/roadmap/developer/triggers", kicker: "Developer roadmap" });
  const og = m.openGraph as { images: { url: string }[] };
  const url = new URL(og.images[0]?.url ?? "");
  assert.equal(url.pathname, "/og");
  assert.equal(url.searchParams.get("t"), "Triggers");
  assert.equal(url.searchParams.get("k"), "Developer roadmap");
});
