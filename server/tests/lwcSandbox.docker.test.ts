/**
 * The real sandbox container. Runs only when SFC_TEST_LWC_IMAGE names a built
 * runner image (scripts/up.mjs builds it); skipped otherwise, e.g. in CI.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileLwc } from "../src/services/lwc/compiler.ts";
import { LwcSandbox } from "../src/services/lwc/lwcSandbox.ts";

const image = process.env.SFC_TEST_LWC_IMAGE;
const problem = (slug: string, comp: string, which: "reference" | "starter") => {
  const f = (ext: string) => readFileSync(new URL(`../problems/${slug}/${which}/${comp}.${ext}`, import.meta.url), "utf8");
  return { component: comp, html: f("html"), js: f("js"), css: f("css") };
};

const lwcProblems = readdirSync(new URL("../problems/", import.meta.url), { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("_")).flatMap(({ name: slug }) => {
  const meta = JSON.parse(readFileSync(new URL(`../problems/${slug}/problem.json`, import.meta.url), "utf8")) as { lwc?: { component: string } };
  return meta.lwc ? [{ slug, comp: meta.lwc.component }] : [];
});

describe.skipIf(!image)("every LWC problem", () => {
  const sandbox = new LwcSandbox(image ?? "");
  it.each(lwcProblems)("$slug: reference passes every hidden test, starter fails one", async ({ slug, comp }) => {
    const hidden = readFileSync(new URL(`../problems/${slug}/tests/${comp}.hidden.test.js`, import.meta.url), "utf8");
    const ref = await sandbox.run(await compileLwc(problem(slug, comp, "reference")), hidden);
    expect(ref.error).toBeUndefined();
    expect(ref.tests?.filter((t) => !t.passed)).toEqual([]);
    const starter = await sandbox.run(await compileLwc(problem(slug, comp, "starter")), hidden);
    expect(starter.tests?.some((t) => !t.passed) ?? true).toBe(true);
  }, 30_000);
});

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
