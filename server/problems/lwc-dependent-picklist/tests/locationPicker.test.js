const PLACES = [
  { name: "India", cities: ["Pune", "Delhi"] },
  { name: "Japan", cities: ["Tokyo", "Osaka"] },
];
async function choose(el, q, flush, selector, value) {
  const select = q(el, selector);
  select.value = value;
  select.dispatchEvent(new CustomEvent("change"));
  await flush();
}

const tests = [
  {
    name: "lists countries and starts with the city disabled",
    async run({ mount, q, qa, equal }) {
      const el = mount({ countries: PLACES });
      equal(qa(el, "select.country option").map((o) => o.textContent.trim()).join("|"), "Choose a country|India|Japan");
      equal(q(el, "select.city").disabled, true, "No city until a country is chosen");
    },
  },
  {
    name: "choosing a country lists its cities",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount({ countries: PLACES });
      await choose(el, q, flush, "select.country", "Japan");
      equal(q(el, "select.city").disabled, false);
      equal(qa(el, "select.city option").map((o) => o.value).join("|"), "|Tokyo|Osaka");
    },
  },
];
