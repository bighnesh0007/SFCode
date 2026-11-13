import { describe, expect, it } from "vitest";
import { codeSize, sizeStats } from "../src/domain/codeSize.ts";

describe("codeSize", () => {
  it("ignores whitespace and comments in every file", () => {
    const a = { "A.cls": "public class A {\n  // explains\n  /* block\n comment */ Integer x = 1;\n}" };
    const b = { "A.cls": "public class A{Integer x=1;}" };
    expect(codeSize(a)).toBe(codeSize(b));
    expect(codeSize(b)).toBe("publicclassA{Integerx=1;}".length);
    expect(codeSize({ "c.html": "<template><!-- note --><p>hi</p></template>", "c.js": "export default 1;" })).toBe("<template><p>hi</p></template>".length + "exportdefault1;".length);
  });
});

describe("sizeStats", () => {
  const best = new Map([["a", 100], ["b", 200], ["c", 300], ["d", 400]]);
  it("places a solver among the others", () => {
    expect(sizeStats(best, "b")).toEqual({ mine: 200, median: 250, smallest: 100, solvers: 4, smallerThan: 67 });
    expect(sizeStats(best, "a")?.smallerThan).toBe(100);
    expect(sizeStats(best, "d")?.smallerThan).toBe(0);
  });
  it("ties don't count as beaten, and a lone solver has nobody to beat", () => {
    expect(sizeStats(new Map([["a", 5], ["b", 5]]), "a")?.smallerThan).toBe(0);
    expect(sizeStats(new Map([["a", 5]]), "a")).toEqual({ mine: 5, median: 5, smallest: 5, solvers: 1, smallerThan: 0 });
  });
  it("tells a non-solver nothing", () => {
    expect(sizeStats(best, "zed")).toBeNull();
  });
});
