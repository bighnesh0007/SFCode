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
];
