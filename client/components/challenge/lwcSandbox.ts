/**
 * The document loaded into the LWC sandbox iframe.
 *
 * Security model: the iframe is `sandbox="allow-scripts"` WITHOUT
 * allow-same-origin, so it gets an opaque origin — learner code can't read the
 * site's cookies, storage or DOM, or call its API as the user. It talks back
 * only through postMessage, tagged with a per-run nonce the page checks.
 */

export type SandboxMessage =
  | { type: "rendered" }
  | { type: "results"; tests: { name: string; passed: boolean; message: string | null }[] }
  | { type: "error"; message: string };

/** Text placed inside a <script> must not be able to close it early. */
const scriptSafe = (s: string) => s.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

/**
 * Runs before the component bundle (a classic script, so it executes first):
 * - the LWC engine reads process.env.NODE_ENV, which browsers don't have;
 *   "development" gives learners LWC's more helpful error messages.
 * - errors thrown while the bundle loads are recorded, because the harness
 *   (a later module) isn't listening yet when they happen.
 */
const PRELUDE = String.raw`
window.process = { env: { NODE_ENV: "development" } };
window.__sfcEarlyErrors = [];
window.addEventListener("error", (e) => window.__sfcEarlyErrors.push(String(e.message || e.error)));
`;

const HARNESS = String.raw`
const send = (msg) => parent.postMessage({ sfcLwc: NONCE, ...msg }, "*");
window.addEventListener("error", (e) => send({ type: "error", message: String(e.message || e.error) }));
window.addEventListener("unhandledrejection", (e) => send({ type: "error", message: String(e.reason && e.reason.message || e.reason) }));
const lwc = window.__sfcLwc;
if (!lwc) throw new Error("Your component failed to load: " + (window.__sfcEarlyErrors[0] || "unknown error"));
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

export function sandboxDocument(code: string, nonce: string, testsSource: string | null): string {
  const run = testsSource === null
    ? `mount(); send({ type: "rendered" });`
    : `${scriptSafe(testsSource)}
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
send({ type: "results", tests: results });`;

  return `<!doctype html><html><head><meta charset="utf-8">
<style>body{font-family:system-ui,sans-serif;margin:16px;color:#222;background:#fff}button{margin-right:6px}</style>
</head><body><div id="root"></div>
<script>${PRELUDE}</script>
<script type="module">${scriptSafe(code)}</script>
<script type="module">
const NONCE = ${JSON.stringify(nonce)};
${HARNESS}
try {
${run}
} catch (e) {
  send({ type: "error", message: String(e && e.message || e) });
}
</script></body></html>`;
}
