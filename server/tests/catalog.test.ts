import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
      "contacts-by-account",
      "case-urgent-priority",
      "weather-callout",
      "overdue-task-scheduler",
      "block-duplicate-contacts",
      "account-top-parent",
      "soql-hot-tech-accounts",
      "soql-contacts-in-city",
      "soql-accounts-without-contacts",
      "soql-pipeline-by-stage",
      "soql-accounts-with-won-deals",
      "soql-busy-accounts",
      "soql-open-high-cases",
      "soql-contacts-with-open-cases",
      "soql-closing-this-quarter",
      "soql-accounts-to-win-back",
      "debug-soql-in-loop",
      "debug-null-discount",
      "debug-recursive-trigger",
      "debug-off-by-one-buckets",
      "debug-dml-in-loop",
      "debug-soql-injection",
      "debug-missing-map-key",
      "debug-batch-wrong-scope",
      "debug-static-flag-chunks",
      "flow-account-default-rating",
      "flow-won-next-step",
      "flow-key-account-task",
      "flow-shipping-cost",
      "flow-revenue-tier",
      "flow-won-total-loop",
      "flow-hot-account-opps",
      "flow-lock-closed-amount",
      "flow-won-contact-tasks",
      "lwc-click-counter",
      "lwc-contact-filter",
      "lwc-star-rating",
      "lwc-character-counter",
      "lwc-todo-list",
      "lwc-tabs",
      "lwc-sortable-table",
      "lwc-debounced-search",
      "lwc-multi-step-form",
      "lwc-accordion",
      "lwc-cart-total",
      "lwc-password-strength",
      "lwc-dependent-picklist",
      "lwc-show-more",
      "lwc-temperature-converter",
      "lwc-countdown",
      "lwc-undo-redo",
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

  it("hidden tests that filter on a long text area", () => {
    const p = fresh();
    writeFileSync(join(p, "tests", "SfcTextUtilsTest.cls"), "@isTest private class SfcTextUtilsTest { static void t() { Integer n = [SELECT COUNT() FROM Account WHERE Description = 'x']; } }");
    expect(() => loadChallenge(dir, "text-utils")).toThrow(/long text area/);
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

describe("SOQL problem rules", () => {
  let dir: string;
  const fresh = () => {
    dir = mkdtempSync(join(tmpdir(), "sfc-soql-"));
    cpSync(join(PROBLEMS_DIR, "soql-contacts-in-city"), join(dir, "soql-contacts-in-city"), { recursive: true });
    return join(dir, "soql-contacts-in-city");
  };
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("tests must take the reference from the placeholder, not inline it", () => {
    const p = fresh();
    const t = join(p, "tests", "SfcSoqlContactsCityTest.cls");
    writeFileSync(t, readFileSync(t, "utf8").replace("{{REFERENCE_QUERY}}", "'SELECT Id FROM Contact'"));
    expect(() => loadChallenge(dir, "soql-contacts-in-city")).toThrow(/REFERENCE_QUERY/);
  });

  it("a soql file only on the soql track", () => {
    const p = fresh();
    const meta = JSON.parse(readFileSync(join(p, "problem.json"), "utf8")) as Record<string, unknown>;
    writeFileSync(join(p, "problem.json"), JSON.stringify({ ...meta, track: "apex" }));
    expect(() => loadChallenge(dir, "soql-contacts-in-city")).toThrow(/soql-track/);
  });

  it("the reference must be a SELECT", () => {
    const p = fresh();
    writeFileSync(join(p, "reference", "query.soql"), "DELETE FROM Contact");
    expect(() => loadChallenge(dir, "soql-contacts-in-city")).toThrow(/does not declare soql/);
  });

  it("no problem may use the grader's generated class name", () => {
    const p = fresh();
    rmSync(join(p, "..", "soql-contacts-in-city"), { recursive: true });
    cpSync(join(PROBLEMS_DIR, "text-utils"), p, { recursive: true });
    const meta = JSON.parse(readFileSync(join(p, "problem.json"), "utf8")) as Record<string, unknown>;
    writeFileSync(join(p, "problem.json"), JSON.stringify({ ...meta, testClass: "SfcSoqlSubmission" }));
    expect(() => loadChallenge(dir, "soql-contacts-in-city")).toThrow(/reserved/);
  });

  it("SOQL problems need the shared compare helper", () => {
    const c = ChallengeCatalog.load(PROBLEMS_DIR).get("soql-contacts-in-city");
    if (!c) throw new Error("fixture");
    expect(() => new ChallengeCatalog([c], "")).toThrow(/soqlCompare.apex/);
  });
});

describe("flow problems", () => {
  let dir: string;
  const fresh = () => {
    dir = mkdtempSync(join(tmpdir(), "sfc-flow-"));
    cpSync(join(PROBLEMS_DIR, "flow-won-next-step"), join(dir, "flow-won-next-step"), { recursive: true });
    return join(dir, "flow-won-next-step");
  };
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("must not declare editable files", () => {
    const p = fresh();
    const meta = JSON.parse(readFileSync(join(p, "problem.json"), "utf8")) as Record<string, unknown>;
    writeFileSync(join(p, "problem.json"), JSON.stringify({ ...meta, files: [{ name: "SfcX", type: "class" }] }));
    expect(() => loadChallenge(dir, "flow-won-next-step")).toThrow(/flow-track problem has a "flow" block and no files/);
  });

  it("needs its reference flow, active", () => {
    const p = fresh();
    const ref = join(p, "reference", "SFC_Opportunity_Won_Next_Step.flow-meta.xml");
    writeFileSync(ref, readFileSync(ref, "utf8").replace("<status>Active</status>", "<status>Draft</status>"));
    expect(() => loadChallenge(dir, "flow-won-next-step")).toThrow(/Active/);
    rmSync(ref);
    expect(() => loadChallenge(dir, "flow-won-next-step")).toThrow(/must contain exactly SFC_Opportunity_Won_Next_Step.flow-meta.xml/);
  });

  it("only flow-track problems may have a flow block", () => {
    const p = fresh();
    const meta = JSON.parse(readFileSync(join(p, "problem.json"), "utf8")) as Record<string, unknown>;
    writeFileSync(join(p, "problem.json"), JSON.stringify({ ...meta, track: "apex" }));
    expect(() => loadChallenge(dir, "flow-won-next-step")).toThrow(/flow-track/);
  });
});

describe("lwc problems", () => {
  let dir: string;
  const fresh = () => {
    dir = mkdtempSync(join(tmpdir(), "sfc-lwc-"));
    cpSync(join(PROBLEMS_DIR, "lwc-click-counter"), join(dir, "lwc-click-counter"), { recursive: true });
    return join(dir, "lwc-click-counter");
  };
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("need all three component files in starter and reference", () => {
    const p = fresh();
    rmSync(join(p, "reference", "clickCounter.css"));
    expect(() => loadChallenge(dir, "lwc-click-counter")).toThrow(/must contain exactly clickCounter.html, clickCounter.js, clickCounter.css/);
  });

  it("need a test file that defines `const tests`", () => {
    const p = fresh();
    writeFileSync(join(p, "tests", "clickCounter.test.js"), "export default [];");
    expect(() => loadChallenge(dir, "lwc-click-counter")).toThrow(/const tests/);
  });

  it("can't mix in Apex grading fields", () => {
    const p = fresh();
    const meta = JSON.parse(readFileSync(join(p, "problem.json"), "utf8")) as Record<string, unknown>;
    writeFileSync(join(p, "problem.json"), JSON.stringify({ ...meta, testClass: "SfcClickTest" }));
    expect(() => loadChallenge(dir, "lwc-click-counter")).toThrow(/no files, flow or testClass/);
  });
});

describe("debugging problems", () => {
  it("must ship a starter that differs from the reference", () => {
    const dir = mkdtempSync(join(tmpdir(), "sfc-debug-"));
    try {
      cpSync(join(PROBLEMS_DIR, "debug-null-discount"), join(dir, "debug-null-discount"), { recursive: true });
      const p = join(dir, "debug-null-discount");
      writeFileSync(join(p, "starter", "SfcDiscount.cls"), readFileSync(join(p, "reference", "SfcDiscount.cls"), "utf8"));
      expect(() => loadChallenge(dir, "debug-null-discount")).toThrow(/must contain the bug/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("ChallengeCatalog", () => {
  it("rejects two problems sharing an Apex name", () => {
    const a = ChallengeCatalog.load(PROBLEMS_DIR).get("text-utils");
    if (!a) throw new Error("fixture missing");
    expect(() => new ChallengeCatalog([a, { ...a, slug: "copy", order: 99 }])).toThrow(/also used by/);
  });
});
