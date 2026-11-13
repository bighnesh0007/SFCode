// Hidden tests: graded on the server when the learner submits. Includes every visible test.
const tests = [
  {
    name: "adds a trimmed item and clears the input",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount();
      q(el, ".new-item").value = "  Buy milk  ";
      q(el, ".add").click();
      await flush();
      equal(qa(el, ".item").length, 1, "One item after adding");
      equal(q(el, ".item .text").textContent, "Buy milk", "The text is trimmed");
      equal(q(el, ".new-item").value, "", "The input is cleared");
      equal(q(el, ".summary").textContent, "0 of 1 done");
    },
  },
  {
    name: "toggles done",
    async run({ mount, q, flush, assert, equal }) {
      const el = mount();
      q(el, ".new-item").value = "Walk";
      q(el, ".add").click();
      await flush();
      q(el, ".item .text").click();
      await flush();
      assert(q(el, ".item").classList.contains("done"), "Clicking the text marks the item done");
      equal(q(el, ".summary").textContent, "1 of 1 done");
    },
  },
{
    name: "ignores blank input",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount();
      q(el, ".new-item").value = "   ";
      q(el, ".add").click();
      await flush();
      equal(qa(el, ".item").length, 0, "Blank text adds nothing");
    },
  },
  {
    name: "removes the right item",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount({ items: ["One", "Two", "Three"] });
      await flush();
      equal(qa(el, ".item").length, 3, "items seeds the list");
      qa(el, ".item")[1].querySelector(".remove").click();
      await flush();
      equal(qa(el, ".item .text").map((s) => s.textContent).join(","), "One,Three", "Remove deletes only that item");
      equal(q(el, ".summary").textContent, "0 of 2 done");
    },
  },
  {
    name: "toggling twice undoes it",
    async run({ mount, q, flush, assert }) {
      const el = mount({ items: ["A"] });
      await flush();
      q(el, ".item .text").click();
      await flush();
      q(el, ".item .text").click();
      await flush();
      assert(!q(el, ".item").classList.contains("done"), "A second click marks it not done");
    },
  },
];
