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
];
