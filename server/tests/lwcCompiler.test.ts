import { describe, expect, it } from "vitest";
import { compileLwc } from "../src/services/lwc/compiler.ts";

const ok = {
  component: "greeting",
  html: `<template><p class="msg">Hello, {name}!</p></template>`,
  js: `import { LightningElement, api } from "lwc";\nexport default class Greeting extends LightningElement { @api name = "World"; }\n`,
  css: `.msg { color: red; }`,
};

describe("compileLwc", () => {
  it("bundles the component and the engine into one self-contained module", async () => {
    const code = await compileLwc(ok);
    expect(code).toContain("window.__sfcLwc");
    expect(code).toContain("color: red");
    // Self-contained: nothing left to import in the sandbox.
    expect(code).not.toMatch(/^import .* from ['"]lwc['"]/m);
  }, 30_000);

  it("reports template errors without leaking server paths", async () => {
    const err = await compileLwc({ ...ok, html: `<div>no root template tag</div>` }).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 422, code: "UNPROCESSABLE" });
    expect((err as Error).message).not.toContain(".run/lwc");
  }, 30_000);

  it("reports JavaScript syntax errors as 422", async () => {
    await expect(compileLwc({ ...ok, js: "export default class {" })).rejects.toMatchObject({ status: 422 });
  }, 30_000);

  it("rejects oversized input and bad component names before compiling", async () => {
    await expect(compileLwc({ ...ok, js: "x".repeat(20_001) })).rejects.toThrow(/longer than/);
    await expect(compileLwc({ ...ok, component: "../evil" })).rejects.toThrow(/Invalid component name/);
  });
});
