// Hidden tests: graded on the server when the learner submits. Includes every visible test.
const tests = [
  {
    name: "starts at 0/140",
    async run({ mount, q, equal }) {
      const el = mount();
      equal(q(el, ".counter")?.textContent, "0/140", "Expected the .counter to read \"0/140\"");
      equal(q(el, ".remaining")?.textContent, "140 characters left");
    },
  },
  {
    name: "counts as you type",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      const input = q(el, ".input");
      input.value = "Hello";
      input.dispatchEvent(new CustomEvent("input"));
      await flush();
      equal(q(el, ".counter").textContent, "5/140");
      equal(q(el, ".remaining").textContent, "135 characters left");
    },
  },
{
    name: "uses the max property and flags going over",
    async run({ mount, q, flush, equal, assert }) {
      const el = mount({ max: 5 });
      const input = q(el, ".input");
      input.value = "12345";
      input.dispatchEvent(new CustomEvent("input"));
      await flush();
      equal(q(el, ".counter").textContent, "5/5");
      assert(!q(el, ".counter").classList.contains("over"), "Exactly max is not over");
      equal(q(el, ".remaining").textContent, "0 characters left");
      input.value = "123456";
      input.dispatchEvent(new CustomEvent("input"));
      await flush();
      assert(q(el, ".counter").classList.contains("over"), "Past max, the counter needs the class over");
      equal(q(el, ".remaining").textContent, "1 character over", "Singular for exactly one");
    },
  },
  {
    name: "singular when one is left",
    async run({ mount, q, flush, equal }) {
      const el = mount({ max: 3 });
      const input = q(el, ".input");
      input.value = "ab";
      input.dispatchEvent(new CustomEvent("input"));
      await flush();
      equal(q(el, ".remaining").textContent, "1 character left");
    },
  },
  {
    name: "re-renders when max changes",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      el.max = 10;
      await flush();
      equal(q(el, ".counter").textContent, "0/10");
    },
  },
];
