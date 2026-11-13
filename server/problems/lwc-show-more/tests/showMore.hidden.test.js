// Hidden tests: graded on the server when the learner submits. Includes every visible test.
const LONG = "abcdefghijklmnopqrstuvwxyz";

const tests = [
  {
    name: "long text starts collapsed with an ellipsis",
    async run({ mount, q, equal }) {
      const el = mount({ text: LONG, limit: 10 });
      equal(q(el, ".text").textContent, "abcdefghij…");
      equal(q(el, "button.toggle").textContent.trim(), "Show more");
      equal(q(el, "button.toggle").getAttribute("aria-expanded"), "false");
    },
  },
  {
    name: "Show more expands to the full text",
    async run({ mount, q, flush, equal }) {
      const el = mount({ text: LONG, limit: 10 });
      q(el, "button.toggle").click();
      await flush();
      equal(q(el, ".text").textContent, LONG);
      equal(q(el, "button.toggle").textContent.trim(), "Show less");
      equal(q(el, "button.toggle").getAttribute("aria-expanded"), "true");
    },
  },
  {
    name: "Show less collapses again",
    async run({ mount, q, flush, equal }) {
      const el = mount({ text: LONG, limit: 10 });
      q(el, "button.toggle").click();
      await flush();
      q(el, "button.toggle").click();
      await flush();
      equal(q(el, ".text").textContent, "abcdefghij…");
    },
  },
  {
    name: "short text is shown in full with no button",
    async run({ mount, q, equal }) {
      const el = mount({ text: "short", limit: 10 });
      equal(q(el, ".text").textContent, "short");
      equal(q(el, "button.toggle"), null, "Nothing to expand, so no button");
    },
  },
  {
    name: "text exactly at the limit needs no button",
    async run({ mount, q, equal }) {
      const el = mount({ text: "abcdefghij", limit: 10 });
      equal(q(el, "button.toggle"), null);
      equal(q(el, ".text").textContent, "abcdefghij");
    },
  },
  {
    name: "uses 100 characters by default",
    async run({ mount, q, equal }) {
      const el = mount({ text: "x".repeat(150) });
      equal(q(el, ".text").textContent, "x".repeat(100) + "…");
    },
  },
];
