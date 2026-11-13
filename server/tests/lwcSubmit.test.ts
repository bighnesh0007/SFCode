import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROBLEMS_DIR } from "../src/container.ts";
import { ChallengeCatalog } from "../src/services/challenges/catalog.ts";
import { ChallengeService } from "../src/services/challenges/challenge.service.ts";
import { LwcCompileError } from "../src/services/lwc/compiler.ts";
import type { SandboxResult } from "../src/services/lwc/lwcSandbox.ts";
import { fixedClock, MemorySubmissionRepository } from "./fakes.ts";

const catalog = ChallengeCatalog.load(PROBLEMS_DIR);

function setup(run: (code: string, tests: string) => SandboxResult) {
  const clock = fixedClock();
  const subs = new MemorySubmissionRepository(clock);
  const service = new ChallengeService(catalog, subs, undefined, clock);
  const seen: string[] = [];
  service.setLwcGrader({
    compile: (src) => (src.js.includes("SYNTAX") ? Promise.reject(new LwcCompileError("Unexpected token")) : Promise.resolve(`compiled:${src.component}`)),
    run: (code, tests) => {
      seen.push(tests);
      return Promise.resolve(run(code, tests));
    },
  });
  return { service, subs, seen };
}
const files = { html: "<template></template>", js: "export default class X {}", css: "" };

describe("LWC submissions (server sandbox)", () => {
  it("runs the HIDDEN tests, records an accepted solve that scores", async () => {
    const { service, subs, seen } = setup(() => ({ tests: [{ name: "a", passed: true, message: null }, { name: "b", passed: true, message: null }] }));
    const view = await service.submitLwc("u", "lwc-click-counter", files);
    expect(view).toMatchObject({ status: "accepted", result: { testsRun: 2, testsPassed: 2 } });
    expect(seen[0]).toBe(catalog.get("lwc-click-counter")?.lwc?.hiddenTests);
    expect(await subs.progress("u")).toEqual(new Map([["lwc-click-counter", "solved"]]));
  });

  it("any failing hidden test is wrong_answer; sandbox errors and compile errors are reported", async () => {
    const partial = setup(() => ({ tests: [{ name: "a", passed: true, message: null }, { name: "b", passed: false, message: "expected 2, got 1" }] }));
    expect((await partial.service.submitLwc("u", "lwc-click-counter", files)).status).toBe("wrong_answer");
    const crashed = setup(() => ({ error: "Your component used too much memory (over 256 MB)." }));
    expect(await crashed.service.submitLwc("u", "lwc-click-counter", files)).toMatchObject({ status: "wrong_answer", result: { message: expect.stringMatching(/memory/) } });
    const broken = setup(() => ({ tests: [] }));
    expect((await broken.service.submitLwc("u", "lwc-star-rating", { ...files, js: "SYNTAX" })).status).toBe("compile_error");
    const none = setup(() => ({ tests: [] }));
    expect((await none.service.submitLwc("u", "lwc-star-rating", files)).status).toBe("wrong_answer"); // zero tests never passes
  });

  it("only LWC problems; unavailable without the sandbox", async () => {
    const { service } = setup(() => ({ tests: [] }));
    await expect(service.submitLwc("u", "text-utils", files)).rejects.toThrow(/Only LWC/);
    const bare = new ChallengeService(catalog, new MemorySubmissionRepository(fixedClock()), undefined, fixedClock());
    await expect(bare.submitLwc("u", "lwc-click-counter", files)).rejects.toThrow(/unavailable/);
  });
});

describe("browser and server harnesses agree", () => {
  it("define the same test helpers (mount, q, qa, flush, assert, equal)", () => {
    const helpers = (src: string) =>
      src
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^(const (mount|q|qa|flush|fmt|assert|equal) =|root\.|const el =|Object\.assign|return el;|if \(actual)/.test(l));
    const server = readFileSync(new URL("../sandbox/lwc-runner/runner.mjs", import.meta.url), "utf8");
    const client = readFileSync(new URL("../../client/components/challenge/lwcSandbox.ts", import.meta.url), "utf8");
    expect(helpers(server).length).toBeGreaterThan(8);
    expect(helpers(server)).toEqual(helpers(client));
  });
});
