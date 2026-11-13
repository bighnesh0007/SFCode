function fill(el, q, selector, text) {
  const input = q(el, selector);
  input.value = text;
  input.dispatchEvent(new CustomEvent("input"));
}
const stepText = (el, q) => q(el, "p.step").textContent.trim();

const tests = [
  {
    name: "starts on step 1 with Next and no Back",
    async run({ mount, q, equal }) {
      const el = mount();
      equal(stepText(el, q), "Step 1 of 3");
      equal(q(el, "input.name") !== null, true, "Step 1 shows input.name");
      equal(q(el, "button.back"), null, "No Back button on step 1");
      equal(q(el, "button.next") !== null, true);
    },
  },
  {
    name: "Next with an empty name shows an error and stays on step 1",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      fill(el, q, "input.name", "   ");
      q(el, "button.next").click();
      await flush();
      equal(stepText(el, q), "Step 1 of 3");
      equal(q(el, "p.error") !== null, true, "Show p.error when the name is blank");
    },
  },
  {
    name: "walks through to a review of the trimmed values",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      fill(el, q, "input.name", "  Ada ");
      q(el, "button.next").click();
      await flush();
      fill(el, q, "input.email", "ada@example.com");
      q(el, "button.next").click();
      await flush();
      equal(stepText(el, q), "Step 3 of 3");
      equal(q(el, "p.review").textContent.trim(), "Name: Ada, Email: ada@example.com");
    },
  },
];
