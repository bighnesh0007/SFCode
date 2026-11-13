const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function type(el, q, text) {
  const input = q(el, "input.search");
  input.value = text;
  input.dispatchEvent(new CustomEvent("input"));
}

const tests = [
  {
    name: "a burst of typing fires one search, for the final text",
    async run({ mount, q, equal }) {
      const el = mount({ delay: 60 });
      const got = [];
      el.addEventListener("search", (e) => got.push(e.detail));
      type(el, q, "a");
      await sleep(20);
      type(el, q, "ac");
      await sleep(20);
      type(el, q, "acme");
      await sleep(150);
      equal(got.join("|"), "acme", "Only the last text should be searched, once");
    },
  },
  {
    name: "waits for the delay before firing",
    async run({ mount, q, equal }) {
      const el = mount({ delay: 120 });
      const got = [];
      el.addEventListener("search", (e) => got.push(e.detail));
      type(el, q, "acme");
      await sleep(40);
      equal(got.length, 0, "Nothing should fire before the delay has passed");
      await sleep(160);
      equal(got.length, 1);
    },
  },
  {
    name: "shows Searching… only while waiting",
    async run({ mount, q, flush, equal }) {
      const el = mount({ delay: 60 });
      equal(q(el, ".pending"), null, "No indicator before typing");
      type(el, q, "acme");
      await flush();
      equal(q(el, ".pending")?.textContent.trim(), "Searching…");
      await sleep(120);
      equal(q(el, ".pending"), null, "The indicator goes once the search fires");
    },
  },
];
