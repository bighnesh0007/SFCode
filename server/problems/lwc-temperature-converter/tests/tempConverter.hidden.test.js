// Hidden tests: graded on the server when the learner submits. Includes every visible test.
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
  {
    name: "rounds to one decimal place",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      await type(el, q, flush, "input.celsius", "37");
      equal(q(el, "input.fahrenheit").value, "98.6");
      await type(el, q, flush, "input.fahrenheit", "100");
      equal(q(el, "input.celsius").value, "37.8");
    },
  },
  {
    name: "negative values convert too",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      await type(el, q, flush, "input.celsius", "-40");
      equal(q(el, "input.fahrenheit").value, "-40");
    },
  },
  {
    name: "clearing one input clears the other",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      await type(el, q, flush, "input.celsius", "20");
      await type(el, q, flush, "input.celsius", "");
      equal(q(el, "input.fahrenheit").value, "", "An empty Celsius box must not become 32 °F");
    },
  },
  {
    name: "the box being typed in keeps what was typed",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      await type(el, q, flush, "input.celsius", "36.66");
      equal(q(el, "input.celsius").value, "36.66", "Only the other box is rounded");
      equal(q(el, "input.fahrenheit").value, "98");
    },
  },
];
