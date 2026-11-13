// Hidden tests: graded on the server when the learner submits. Includes every visible test.
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
{
    name: "arrow keys move and wrap",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount({ tabs: TABS });
      const list = q(el, "[role=tablist]");
      list.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      await flush();
      equal(q(el, ".panel").textContent, "Third panel", "ArrowLeft on the first tab wraps to the last");
      list.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      await flush();
      equal(q(el, ".panel").textContent, "First panel", "ArrowRight on the last tab wraps to the first");
      list.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      await flush();
      equal(qa(el, ".tab")[1].getAttribute("aria-selected"), "true");
    },
  },
  {
    name: "uses roles",
    async run({ mount, q, qa, assert }) {
      const el = mount({ tabs: TABS });
      assert(q(el, "[role=tablist]"), "Wrap the tabs in role=tablist");
      assert(qa(el, ".tab").every((t) => t.getAttribute("role") === "tab"), "Each tab has role=tab");
      assert(q(el, ".panel")?.getAttribute("role") === "tabpanel", "The panel has role=tabpanel");
    },
  },
  {
    name: "no tabs, no panel",
    async run({ mount, q, qa, equal, assert }) {
      const el = mount({ tabs: [] });
      equal(qa(el, ".tab").length, 0);
      assert(!q(el, ".panel"), "With no tabs, render no panel");
    },
  },
];
