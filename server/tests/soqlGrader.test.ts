import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { PROBLEMS_DIR } from "../src/container.ts";
import { ChallengeCatalog } from "../src/services/challenges/catalog.ts";
import { apexStringLiteral, buildDeployPackage, interpretDeployResult, materialiseTests, soqlSubmissionClass } from "../src/services/challenges/grader.ts";

const catalog = ChallengeCatalog.load(PROBLEMS_DIR);
const soql = catalog.get("soql-contacts-in-city");
if (!soql) throw new Error("problem missing");

/** Minimal Apex single-quoted literal parser: the inverse of apexStringLiteral, and the oracle for it. */
function parseApexLiteral(src: string): { value: string; rest: string } {
  if (!src.startsWith("'")) throw new Error("not a literal");
  let out = "";
  for (let i = 1; i < src.length; i++) {
    const ch = src[i] ?? "";
    if (ch === "\\") {
      const next = src[++i];
      out += next === "n" ? "\n" : next === "r" ? "\r" : next === "t" ? "\t" : (next ?? "");
    } else if (ch === "'") {
      return { value: out, rest: src.slice(i + 1) };
    } else if (ch === "\n" || ch === "\r") {
      throw new Error("raw newline inside literal");
    } else {
      out += ch;
    }
  }
  throw new Error("unterminated literal");
}

describe("apexStringLiteral", () => {
  it.each([
    "SELECT Id FROM Account WHERE Name = 'O\\'Brien'",
    "x'; System.debug('pwned'); String y = '",
    "back\\\\slash \\' and quote '",
    "multi\nline\r\nquery\twith tabs",
    "$& $' $` $$ dollar patterns",
  ])("round-trips %j as exactly one literal with nothing after it", (input) => {
    const parsed = parseApexLiteral(apexStringLiteral(input));
    expect(parsed.value).toBe(input);
    expect(parsed.rest).toBe("");
  });

  it("a hostile query stays inside the QUERY constant", () => {
    const cls = soqlSubmissionClass("x'; delete [SELECT Id FROM Account]; String y = '");
    const literal = /QUERY = (.*);\n\}\n$/s.exec(cls)?.[1] ?? "";
    expect(parseApexLiteral(literal).rest).toBe("");
    expect(cls.split("\n")).toHaveLength(4);
  });
});

describe("SOQL packaging", () => {
  it("fills both placeholders and leaves none behind", () => {
    if (!soql) return;
    const tests = materialiseTests(soql, catalog.soqlCompare);
    expect(tests).not.toContain("{{");
    expect(tests).toContain(apexStringLiteral((soql.reference.query ?? "").trim()));
    expect(tests).toContain("private static void sfcAssertSameRows");
  });

  it("deploys the wrapper class, never a .soql file", () => {
    if (!soql) return;
    const zip = unzipSync(Buffer.from(buildDeployPackage(soql, { query: "SELECT Id FROM Contact" }, "62.0", catalog.soqlCompare), "base64"));
    expect(Object.keys(zip).sort()).toEqual([
      "classes/SfcSoqlContactsCityTest.cls",
      "classes/SfcSoqlContactsCityTest.cls-meta.xml",
      "classes/SfcSoqlSubmission.cls",
      "classes/SfcSoqlSubmission.cls-meta.xml",
      "package.xml",
    ]);
    expect(strFromU8(zip["classes/SfcSoqlSubmission.cls"] ?? new Uint8Array())).toContain("QUERY = 'SELECT Id FROM Contact';");
    expect(strFromU8(zip["package.xml"] ?? new Uint8Array())).toContain("<members>SfcSoqlSubmission</members>");
  });

  it("maps a wrapper compile error to query.soql without meaningless positions", () => {
    if (!soql) return;
    const r = interpretDeployResult(soql, {
      done: "true",
      status: "Failed",
      success: "false",
      details: { componentFailures: [{ fileName: "classes/SfcSoqlSubmission.cls", lineNumber: "2", columnNumber: "40", problem: "boom" }] },
    });
    expect(r.compileErrors).toEqual([{ file: "query.soql", line: null, column: null, message: "boom" }]);
  });
});
