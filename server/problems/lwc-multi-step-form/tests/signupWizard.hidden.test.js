// Hidden tests: graded on the server when the learner submits. Includes every visible test.
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
  {
    name: "rejects a malformed email",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      fill(el, q, "input.name", "Ada");
      q(el, "button.next").click();
      await flush();
      for (const bad of ["ada", "ada@example", "a da@example.com", "ada@@example.com"]) {
        fill(el, q, "input.email", bad);
        q(el, "button.next").click();
        await flush();
        equal(stepText(el, q), "Step 2 of 3", `"${bad}" isn't a valid email`);
        equal(q(el, "p.error") !== null, true);
      }
    },
  },
  {
    name: "the error clears once the step passes",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      q(el, "button.next").click();
      await flush();
      fill(el, q, "input.name", "Ada");
      q(el, "button.next").click();
      await flush();
      equal(stepText(el, q), "Step 2 of 3");
      equal(q(el, "p.error"), null, "A passing step clears the error");
    },
  },
  {
    name: "returning to a step restores its saved value",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      fill(el, q, "input.name", "Ada");
      q(el, "button.next").click();
      await flush();
      fill(el, q, "input.email", "ada@example.com");
      q(el, "button.next").click();
      await flush();
      q(el, "button.back").click();
      await flush();
      equal(q(el, "input.email").value, "ada@example.com", "Step 2's input shows the saved email");
      q(el, "button.back").click();
      await flush();
      equal(q(el, "input.name").value, "Ada", "Step 1's input shows the saved name");
      equal(q(el, "button.back"), null);
    },
  },
  {
    name: "going back clears an error",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      fill(el, q, "input.name", "Ada");
      q(el, "button.next").click();
      await flush();
      q(el, "button.next").click();
      await flush();
      equal(q(el, "p.error") !== null, true);
      q(el, "button.back").click();
      await flush();
      equal(q(el, "p.error"), null);
    },
  },
  {
    name: "submit sends the trimmed name and email",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      let detail = null;
      el.addEventListener("submit", (e) => (detail = e.detail));
      fill(el, q, "input.name", " Ada Lovelace ");
      q(el, "button.next").click();
      await flush();
      fill(el, q, "input.email", " ada@example.com ");
      q(el, "button.next").click();
      await flush();
      equal(q(el, "button.next"), null, "Step 3 has Submit instead of Next");
      q(el, "button.submit").click();
      await flush();
      equal(JSON.stringify(detail), JSON.stringify({ name: "Ada Lovelace", email: "ada@example.com" }));
    },
  },
];
