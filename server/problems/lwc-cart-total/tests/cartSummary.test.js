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
];
