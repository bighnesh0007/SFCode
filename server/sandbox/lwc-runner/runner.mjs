// Grades one compiled LWC component inside the sandbox container.
// stdin: {"code": "<compiled bundle>", "tests": "<test source defining const tests = [...]>"}
// stdout: {"tests": [{name, passed, message}]} or {"error": "..."}
//
// The helpers below (mount, q, qa, flush, assert, equal) must match the
// browser harness in client/components/challenge/lwcSandbox.ts; a server
// test fails if they drift.
import { JSDOM } from "jsdom";

const HARD_LIMIT_MS = 8000;
const out = (o) => {
  process.stdout.write(JSON.stringify(o));
  process.exit(0);
};
setTimeout(() => out({ error: "Your component or the tests took too long (over 8 seconds)." }), HARD_LIMIT_MS).unref();

let input = "";
for await (const chunk of process.stdin) input += chunk;
const { code, tests } = JSON.parse(input);

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.process = { env: { NODE_ENV: "development" } };
const errors = [];
window.addEventListener("error", (e) => errors.push(String(e.message || e.error)));

try {
  window.eval(code);
} catch (e) {
  out({ error: `Your component failed to load: ${String((e && e.message) || e)}` });
}
if (!window.__sfcLwc) out({ error: `Your component failed to load: ${errors[0] || "unknown error"}` });

const HARNESS = String.raw`
const lwc = window.__sfcLwc;
const root = document.getElementById("root");
const mount = (props = {}) => {
  root.replaceChildren();
  const el = lwc.createElement("c-component", { is: lwc.Component });
  Object.assign(el, props);
  root.appendChild(el);
  return el;
};
const q = (el, selector) => el.shadowRoot && el.shadowRoot.querySelector(selector);
const qa = (el, selector) => (el.shadowRoot ? Array.from(el.shadowRoot.querySelectorAll(selector)) : []);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const fmt = (v) => (typeof v === "string" ? JSON.stringify(v) : String(v));
const assert = (cond, message) => { if (!cond) throw new Error(message || "Assertion failed"); };
const equal = (actual, expected, message) => {
  if (actual !== expected) throw new Error((message ? message + " — " : "") + "expected " + fmt(expected) + ", got " + fmt(actual));
};
`;

window.__sfcDone = null;
window.eval(`(async () => {
${HARNESS}
${tests}
const results = [];
for (const t of tests) {
  try {
    await t.run({ mount, q, qa, flush, assert, equal });
    results.push({ name: t.name, passed: true, message: null });
  } catch (e) {
    results.push({ name: t.name, passed: false, message: String(e && e.message || e) });
  }
}
root.replaceChildren();
return results;
})().then((r) => { window.__sfcDone = { tests: r }; }, (e) => { window.__sfcDone = { error: String(e && e.message || e) }; });`);

const wait = () => (window.__sfcDone ? out(window.__sfcDone) : setTimeout(wait, 10));
wait();
