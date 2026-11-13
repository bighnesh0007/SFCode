async function type(el, q, flush, selector, text) {
  const input = q(el, selector);
  input.value = text;
  input.dispatchEvent(new CustomEvent("input"));
  await flush();
}

const tests = [
  {
    name: "celsius updates fahrenheit",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      await type(el, q, flush, "input.celsius", "100");
      equal(q(el, "input.fahrenheit").value, "212");
    },
  },
  {
    name: "fahrenheit updates celsius",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      await type(el, q, flush, "input.fahrenheit", "32");
      equal(q(el, "input.celsius").value, "0");
    },
  },
];
