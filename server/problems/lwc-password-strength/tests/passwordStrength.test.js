async function type(el, q, flush, text) {
  const input = q(el, "input.password");
  input.value = text;
  input.dispatchEvent(new CustomEvent("input"));
  await flush();
}

const tests = [
  {
    name: "shows nothing until something is typed",
    async run({ mount, q, equal }) {
      const el = mount();
      equal(q(el, ".strength"), null);
      equal(q(el, ".rule"), null);
    },
  },
  {
    name: "a short lower-case password is weak",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount();
      await type(el, q, flush, "abc");
      equal(q(el, ".strength").textContent.trim(), "Weak");
      equal(q(el, ".strength").classList.contains("weak"), true, "The strength paragraph also gets the class weak");
      equal(qa(el, ".rule").length, 4);
    },
  },
];
