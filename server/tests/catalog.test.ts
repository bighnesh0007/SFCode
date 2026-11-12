import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PROBLEMS_DIR } from "../src/container.ts";
import { ChallengeCatalog, loadChallenge } from "../src/services/challenges/catalog.ts";

describe("the shipped problems", () => {
  const catalog = ChallengeCatalog.load(PROBLEMS_DIR);

  it("all load and validate", () => {
    expect(catalog.all().map((c) => c.slug)).toEqual([
      "account-rating-default",
      "protect-closed-won",
      "text-utils",
      "won-revenue-rollup",
      "close-stale-opportunities",
      "sync-contact-city",
    ]);
  });
});

describe("loadChallenge rejects broken problems", () => {
  let dir: string;
  const fresh = () => {
    dir = mkdtempSync(join(tmpdir(), "sfc-problems-"));
    cpSync(join(PROBLEMS_DIR, "text-utils"), join(dir, "text-utils"), { recursive: true });
    return join(dir, "text-utils");
  };
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("a starter file that is missing", () => {
    const p = fresh();
    rmSync(join(p, "starter", "SfcTextUtils.cls"));
    expect(() => loadChallenge(dir, "text-utils")).toThrow(/starter is missing SfcTextUtils.cls/);
  });

  it("an extra file the user could not edit", () => {
    const p = fresh();
    writeFileSync(join(p, "reference", "Extra.cls"), "public class Extra {}");
    expect(() => loadChallenge(dir, "text-utils")).toThrow(/unexpected files: Extra.cls/);
  });

  it("a file that declares a different class", () => {
    const p = fresh();
    writeFileSync(join(p, "reference", "SfcTextUtils.cls"), "public class SomethingElse {}");
    expect(() => loadChallenge(dir, "text-utils")).toThrow(/does not declare class SfcTextUtils/);
  });

  it("hidden tests that read org data", () => {
    const p = fresh();
    writeFileSync(join(p, "tests", "SfcTextUtilsTest.cls"), "@isTest(SeeAllData=true) private class SfcTextUtilsTest {}");
    expect(() => loadChallenge(dir, "text-utils")).toThrow(/SeeAllData/);
  });

  it("names without the Sfc prefix", () => {
    const p = fresh();
    writeFileSync(join(p, "problem.json"), JSON.stringify({ title: "T", difficulty: "Easy", category: "Classes", order: 1, files: [{ name: "TextUtils", type: "class" }], testClass: "SfcTextUtilsTest" }));
    expect(() => loadChallenge(dir, "text-utils")).toThrow(/starting with Sfc/);
  });

  it("an unknown difficulty", () => {
    const p = fresh();
    writeFileSync(join(p, "problem.json"), JSON.stringify({ title: "Tt", difficulty: "Insane", category: "Classes", order: 1, files: [{ name: "SfcTextUtils", type: "class" }], testClass: "SfcTextUtilsTest" }));
    expect(() => loadChallenge(dir, "text-utils")).toThrow(/difficulty/);
  });
});

describe("ChallengeCatalog", () => {
  it("rejects two problems sharing an Apex name", () => {
    const a = ChallengeCatalog.load(PROBLEMS_DIR).get("text-utils");
    if (!a) throw new Error("fixture missing");
    expect(() => new ChallengeCatalog([a, { ...a, slug: "copy", order: 99 }])).toThrow(/also used by/);
  });
});
