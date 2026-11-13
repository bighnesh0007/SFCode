// Hidden tests: graded on the server when the learner submits. Includes every visible test.
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
  {
    name: "choosing a city reports the location",
    async run({ mount, q, flush, equal }) {
      const el = mount({ countries: PLACES });
      let detail = null;
      el.addEventListener("select", (e) => (detail = e.detail));
      await choose(el, q, flush, "select.country", "India");
      await choose(el, q, flush, "select.city", "Delhi");
      equal(JSON.stringify(detail), JSON.stringify({ country: "India", city: "Delhi" }));
    },
  },
  {
    name: "changing the country resets the city",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount({ countries: PLACES });
      await choose(el, q, flush, "select.country", "India");
      await choose(el, q, flush, "select.city", "Pune");
      await choose(el, q, flush, "select.country", "Japan");
      equal(q(el, "select.city").value, "", "The old city doesn't carry over");
      equal(qa(el, "select.city option").map((o) => o.value).join("|"), "|Tokyo|Osaka");
      await choose(el, q, flush, "select.country", "India");
      equal(q(el, "select.city").value, "", "Back on India, Pune must not reappear: the city was reset, not just hidden");
    },
  },
  {
    name: "going back to no country disables the city again",
    async run({ mount, q, flush, equal }) {
      const el = mount({ countries: PLACES });
      await choose(el, q, flush, "select.country", "India");
      await choose(el, q, flush, "select.country", "");
      equal(q(el, "select.city").disabled, true);
    },
  },
  {
    name: "no event until a city is chosen",
    async run({ mount, q, flush, equal }) {
      const el = mount({ countries: PLACES });
      let fired = 0;
      el.addEventListener("select", () => fired++);
      await choose(el, q, flush, "select.country", "India");
      equal(fired, 0, "Choosing only a country isn't a complete location");
    },
  },
];
