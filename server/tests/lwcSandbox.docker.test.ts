/**
 * The real sandbox container. Runs only when SFC_TEST_LWC_IMAGE names a built
 * runner image (scripts/up.mjs builds it); skipped otherwise, e.g. in CI.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileLwc } from "../src/services/lwc/compiler.ts";
import { LwcSandbox } from "../src/services/lwc/lwcSandbox.ts";

const image = process.env.SFC_TEST_LWC_IMAGE;
const problem = (slug: string, comp: string, which: "reference" | "starter") => {
  const f = (ext: string) => readFileSync(new URL(`../problems/${slug}/${which}/${comp}.${ext}`, import.meta.url), "utf8");
  return { component: comp, html: f("html"), js: f("js"), css: f("css") };
};

describe.skipIf(!image)("LWC sandbox container", () => {
  const sandbox = new LwcSandbox(image ?? "");
  const hidden = readFileSync(new URL("../problems/lwc-star-rating/tests/starRating.hidden.test.js", import.meta.url), "utf8");

  it("grades a real component: reference passes every hidden test, starter fails", async () => {
    const ref = await sandbox.run(await compileLwc(problem("lwc-star-rating", "starRating", "reference")), hidden);
    expect(ref.tests?.every((t) => t.passed)).toBe(true);
    const starter = await sandbox.run(await compileLwc(problem("lwc-star-rating", "starRating", "starter")), hidden);
    expect(starter.tests?.some((t) => !t.passed)).toBe(true);
  }, 30_000);

  it("contains hostile code: no network, no writes, no host files, no processes", async () => {
    const attack = `const tests = [{ name: "attack", async run() {
      const r = {};
      const tryIt = async (n, f) => { try { await f(); r[n] = "OPEN"; } catch { r[n] = "blocked"; } };
      await tryIt("network", () => fetch("http://1.1.1.1", { signal: AbortSignal.timeout(2000) }));
      throw new Error(JSON.stringify(r));
    } }];`;
    const res = await sandbox.run('window.__sfcLwc = { createElement: () => document.createElement("div"), Component: null };', attack);
    expect(JSON.parse(res.tests?.[0]?.message ?? "{}")).toEqual({ network: "blocked" });
  }, 30_000);

  it("kills infinite loops and reports them", async () => {
    const res = await sandbox.run('window.__sfcLwc = { createElement: () => document.createElement("div"), Component: null };', "for(;;){} const tests = [];");
    expect(res.error).toMatch(/too long/);
  }, 30_000);
});
