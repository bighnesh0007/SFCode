import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { PROBLEMS_DIR } from "../src/container.ts";
import { ChallengeCatalog } from "../src/services/challenges/catalog.ts";
import { buildDeployPackage, interpretDeployResult } from "../src/services/challenges/grader.ts";
import { SalesforceClient } from "../src/services/salesforce/salesforceClient.ts";

const catalog = ChallengeCatalog.load(PROBLEMS_DIR);
const rating = catalog.get("account-rating-default");
const rollup = catalog.get("won-revenue-rollup");
if (!rating || !rollup) throw new Error("problems missing");

/** Parse a fixture through the real client, so the grader sees exactly what production would. */
async function status(fixture: string) {
  const body = readFileSync(new URL(`./fixtures/${fixture}`, import.meta.url), "utf8");
  const client = new SalesforceClient({ clientId: "c", clientSecret: "s", redirectUri: "r", apiVersion: "62.0", timeoutMs: 1000, fetch: () => Promise.resolve(new Response(body, { status: 200 })) });
  return client.checkDeployStatus("https://a.my.salesforce.com", "t", "0Af");
}

describe("buildDeployPackage", () => {
  it("contains the user's files, the hidden tests and a matching package.xml", () => {
    if (!rollup) return;
    const zip = unzipSync(Buffer.from(buildDeployPackage(rollup, rollup.reference, "62.0"), "base64"));
    expect(Object.keys(zip).sort()).toEqual([
      "classes/SfcRevenueRollupHandler.cls",
      "classes/SfcRevenueRollupHandler.cls-meta.xml",
      "classes/SfcRevenueRollupTest.cls",
      "classes/SfcRevenueRollupTest.cls-meta.xml",
      "package.xml",
      "triggers/SfcRevenueRollup.trigger",
      "triggers/SfcRevenueRollup.trigger-meta.xml",
    ]);
    const pkg = strFromU8(zip["package.xml"] ?? new Uint8Array());
    expect(pkg).toContain("<members>SfcRevenueRollupTest</members><members>SfcRevenueRollupHandler</members><name>ApexClass</name>");
    expect(pkg).toContain("<members>SfcRevenueRollup</members><name>ApexTrigger</name>");
    expect(strFromU8(zip["classes/SfcRevenueRollupTest.cls"] ?? new Uint8Array())).toBe(rollup.testClass.source);
  });

  it("takes file names only from the problem, never from submitted keys", () => {
    if (!rating) return;
    const zip = unzipSync(Buffer.from(buildDeployPackage(rating, { SfcAccountRating: "x", "../../evil": "y" }, "62.0"), "base64"));
    expect(Object.keys(zip).some((k) => k.includes("evil"))).toBe(false);
  });
});

describe("interpretDeployResult", () => {
  it("accepted: all tests pass, coverage reported for the user's files only", async () => {
    if (!rating) return;
    const r = interpretDeployResult(rating, await status("deployStatus-accepted.xml"));
    expect(r).toMatchObject({ verdict: "accepted", testsRun: 4, testsPassed: 4, compileErrors: [], coverage: [{ name: "SfcAccountRating", covered: 4, total: 4 }] });
  });

  it("wrong answer: carries the failing method and its assertion", async () => {
    if (!rating) return;
    const r = interpretDeployResult(rating, await status("deployStatus-wrongAnswer.xml"));
    expect(r.verdict).toBe("wrong_answer");
    expect(r.testsPassed).toBe(1);
    expect(r.tests.find((t) => !t.passed)).toMatchObject({ method: "handles200Records", message: expect.stringContaining("Expected: 100, Actual: 0") });
  });

  it("compile error: names the user's file, hides the test file's name", async () => {
    if (!rating) return;
    const r = interpretDeployResult(rating, await status("deployStatus-compileError.xml"));
    expect(r.verdict).toBe("compile_error");
    expect(r.compileErrors).toEqual([
      { file: "SfcAccountRating.trigger", line: 3, column: 9, message: "Variable does not exist: Ratng" },
      { file: null, line: 1, column: 1, message: "Dependent class is invalid and needs recompilation" },
    ]);
  });

  it("coverage: tests pass but the deploy fails on coverage", async () => {
    if (!rating) return;
    const r = interpretDeployResult(rating, await status("deployStatus-coverage.xml"));
    expect(r.verdict).toBe("coverage");
    expect(r.message).toContain("at least 75% test coverage is required");
  });

  it("an unexplained failure is an error, never accepted", () => {
    if (!rating) return;
    expect(interpretDeployResult(rating, { done: "true", status: "Canceled", success: "false" }).verdict).toBe("error");
    // success without status Succeeded (e.g. SucceededPartial) is not an accept
    expect(interpretDeployResult(rating, { done: "true", status: "SucceededPartial", success: "true" }).verdict).toBe("error");
  });
});

describe("flow packaging", () => {
  const flow = catalog.get("flow-account-default-rating");

  it("includes the reference flow only when one is passed (verify:problems)", () => {
    if (!flow) throw new Error("problem missing");
    const withRef = unzipSync(Buffer.from(buildDeployPackage(flow, flow.reference, "62.0"), "base64"));
    expect(Object.keys(withRef)).toContain("flows/SFC_Account_Default_Rating.flow-meta.xml");
    expect(strFromU8(withRef["package.xml"] ?? new Uint8Array())).toContain("<members>SFC_Account_Default_Rating</members><name>Flow</name>");
    const submission = unzipSync(Buffer.from(buildDeployPackage(flow, {}, "62.0"), "base64"));
    expect(Object.keys(submission).some((k) => k.startsWith("flows/"))).toBe(false);
    expect(strFromU8(submission["package.xml"] ?? new Uint8Array())).not.toContain("<name>Flow</name>");
  });
});
