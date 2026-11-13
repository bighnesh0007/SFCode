const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tests = [
  {
    name: "shows the starting time as m:ss",
    async run({ mount, q, equal }) {
      const el = mount({ seconds: 65 });
      equal(q(el, ".time").textContent.trim(), "1:05");
      equal(q(el, "button.pause").disabled, true, "Pause is disabled until it runs");
    },
  },
  {
    name: "start counts down once a second",
    async run({ mount, q, flush, equal }) {
      const el = mount({ seconds: 10 });
      q(el, "button.start").click();
      await flush();
      equal(q(el, "button.start").disabled, true, "Start is disabled while running");
      await sleep(1150);
      equal(q(el, ".time").textContent.trim(), "0:09", "One tick per second by default");
    },
  },
];
