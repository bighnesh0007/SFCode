// Hidden tests: graded on the server when the learner submits. Includes every visible test.
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

  {
    name: "counts many clicks with a custom label",
    async run({ mount, q, flush, equal }) {
      const el = mount({ label: "Taps" });
      for (let i = 0; i < 7; i++) q(el, ".increment").click();
      await flush();
      equal(q(el, ".count").textContent, "Taps: 7");
    },
  },
  {
    name: "re-renders when the label changes after mounting",
    async run({ mount, q, flush, equal }) {
      const el = mount();
      el.label = "Likes";
      await flush();
      equal(q(el, ".count").textContent, "Likes: 0", "label is a public (@api) property: changing it must re-render");
    },
  },
  {
    name: "reset disables itself again",
    async run({ mount, q, flush, assert }) {
      const el = mount();
      q(el, ".increment").click();
      await flush();
      q(el, ".reset").click();
      await flush();
      assert(q(el, ".reset").disabled === true, "After resetting to 0, Reset should be disabled again");
    },
  },
];
