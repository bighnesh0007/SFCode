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
];
