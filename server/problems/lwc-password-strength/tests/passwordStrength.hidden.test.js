// Hidden tests: graded on the server when the learner submits. Includes every visible test.
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
  {
    name: "a password meeting every rule is strong with no rules listed",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount();
      await type(el, q, flush, "Correct#Horse9");
      equal(q(el, ".strength").textContent.trim(), "Strong");
      equal(q(el, ".strength").classList.contains("strong"), true);
      equal(qa(el, ".rule").length, 0);
    },
  },
  {
    name: "two or three points is medium, and the unmet rules are named",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount();
      await type(el, q, flush, "longpassword1");
      equal(q(el, ".strength").textContent.trim(), "Medium");
      equal(qa(el, ".rule").map((r) => r.textContent.trim()).join("|"), "Upper and lower case letters|A symbol");
    },
  },
  {
    name: "one point is still weak",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      await type(el, q, flush, "abcdefghij");
      equal(q(el, ".strength").textContent.trim(), "Weak", "Only the length rule is met");
    },
  },
  {
    name: "a space counts as a symbol",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount();
      await type(el, q, flush, "Ab1 ");
      equal(qa(el, ".rule").map((r) => r.textContent.trim()).join("|"), "At least 8 characters");
    },
  },
  {
    name: "clearing the input hides the meter again",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      await type(el, q, flush, "abc");
      await type(el, q, flush, "");
      equal(q(el, ".strength"), null);
    },
  },
];
