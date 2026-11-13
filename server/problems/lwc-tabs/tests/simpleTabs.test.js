const TABS = [
  { label: "One", content: "First panel" },
  { label: "Two", content: "Second panel" },
  { label: "Three", content: "Third panel" },
];
const tests = [
  {
    name: "selects the first tab initially",
    async run({ mount, q, qa, equal }) {
      const el = mount({ tabs: TABS });
      const tabs = qa(el, ".tab");
      equal(tabs.length, 3, "One .tab button per tab");
      equal(tabs[0].getAttribute("aria-selected"), "true", "The first tab is selected");
      equal(tabs[1].getAttribute("aria-selected"), "false");
      equal(q(el, ".panel")?.textContent, "First panel");
    },
  },
  {
    name: "clicking selects a tab",
    async run({ mount, q, qa, flush, equal, assert }) {
      const el = mount({ tabs: TABS });
      qa(el, ".tab")[2].click();
      await flush();
      assert(qa(el, ".tab")[2].classList.contains("active"), "The clicked tab gets the class active");
      assert(!qa(el, ".tab")[0].classList.contains("active"), "Only one tab is active");
      equal(q(el, ".panel").textContent, "Third panel");
    },
  },
];
