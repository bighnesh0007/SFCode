const tests = [
  {
    name: "starts at zero with the default label",
    async run({ mount, q, equal }) {
      const el = mount();
      equal(q(el, ".count")?.textContent, "Clicks: 0", "Expected the .count paragraph to read \"Clicks: 0\"");
    },
  },
  {
    name: "uses the label property",
    async run({ mount, q, equal }) {
      const el = mount({ label: "Votes" });
      equal(q(el, ".count")?.textContent, "Votes: 0");
    },
  },
  {
    name: "increments on click",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      q(el, ".increment").click();
      q(el, ".increment").click();
      await flush();
      equal(q(el, ".count").textContent, "Clicks: 2");
    },
  },
  {
    name: "reset is disabled at zero and resets the count",
    async run({ mount, q, flush, equal, assert }) {
      const el = mount();
      assert(q(el, ".reset")?.disabled === true, "Reset should be disabled while the count is 0");
      q(el, ".increment").click();
      await flush();
      assert(q(el, ".reset").disabled === false, "Reset should be enabled once the count is above 0");
      q(el, ".reset").click();
      await flush();
      equal(q(el, ".count").textContent, "Clicks: 0");
    },
  },
];
