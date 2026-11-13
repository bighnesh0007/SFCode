// Hidden tests: graded on the server when the learner submits. Includes every visible test.
const cart = () => [
  { id: "a", name: "Notebook", price: 7.5, quantity: 1 },
  { id: "b", name: "Mug", price: 2.5, quantity: 2 },
];

const tests = [
  {
    name: "shows each line and the total with two decimals",
    async run({ mount, q, qa, equal }) {
      const el = mount({ items: cart() });
      equal(qa(el, "li.item").length, 2);
      equal(qa(el, ".subtotal").map((s) => s.textContent.trim()).join(","), "7.50,5.00", "Subtotals are price × quantity with two decimals");
      equal(q(el, ".total").textContent.trim(), "Total: 12.50");
    },
  },
  {
    name: "inc adds one and updates the totals",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount({ items: cart() });
      qa(el, "button.inc")[1].click();
      await flush();
      equal(qa(el, ".qty")[1].textContent.trim(), "3");
      equal(q(el, ".total").textContent.trim(), "Total: 15.00");
    },
  },
  {
    name: "dec at quantity 1 removes the item",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount({ items: cart() });
      qa(el, "button.dec")[0].click();
      await flush();
      equal(qa(el, "li.item").map((li) => li.querySelector(".name").textContent.trim()).join(","), "Mug");
      equal(q(el, ".total").textContent.trim(), "Total: 5.00");
    },
  },
  {
    name: "an empty cart says so and shows no total",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount({ items: [{ id: "1", name: "Pen", price: 1.2, quantity: 1 }] });
      q(el, "button.dec").click();
      await flush();
      equal(qa(el, "li.item").length, 0);
      equal(q(el, ".total"), null, "No total once the cart is empty");
      equal(q(el, ".empty")?.textContent.trim(), "Your cart is empty");
    },
  },
  {
    name: "every change reports the new quantities",
    async run({ mount, qa, flush, equal }) {
      const el = mount({ items: cart() });
      const got = [];
      el.addEventListener("change", (e) => got.push(JSON.stringify(e.detail)));
      qa(el, "button.inc")[0].click();
      await flush();
      qa(el, "button.dec")[1].click();
      await flush();
      equal(got.join(" | "), '[{"id":"a","quantity":2},{"id":"b","quantity":2}] | [{"id":"a","quantity":2},{"id":"b","quantity":1}]');
    },
  },
  {
    name: "doesn't modify the parent's items",
    async run({ mount, qa, flush, equal }) {
      const items = cart();
      const el = mount({ items });
      qa(el, "button.inc")[0].click();
      await flush();
      equal(items[0].quantity, 1, "Keep your own copy; the parent's objects stay unchanged");
    },
  },
  {
    name: "rounds floating-point totals correctly",
    async run({ mount, q, equal }) {
      const el = mount({ items: [{ id: "x", name: "Gum", price: 0.1, quantity: 3 }] });
      equal(q(el, ".total").textContent.trim(), "Total: 0.30", "0.1 × 3 is shown as 0.30, not 0.30000000000000004");
    },
  },
];
