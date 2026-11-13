// Hidden tests: graded on the server when the learner submits. Includes every visible test.
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
  {
    name: "pause stops the clock",
    async run({ mount, q, flush, equal }) {
      const el = mount({ seconds: 10, tickMs: 100 });
      q(el, "button.start").click();
      await sleep(250);
      q(el, "button.pause").click();
      await flush();
      const shown = q(el, ".time").textContent.trim();
      await sleep(300);
      equal(q(el, ".time").textContent.trim(), shown, "No ticks after pausing");
      equal(q(el, "button.start").disabled, false);
    },
  },
  {
    name: "reset goes back to the start and stops",
    async run({ mount, q, flush, equal }) {
      const el = mount({ seconds: 10, tickMs: 100 });
      q(el, "button.start").click();
      await sleep(250);
      q(el, "button.reset").click();
      await flush();
      equal(q(el, ".time").textContent.trim(), "0:10");
      await sleep(300);
      equal(q(el, ".time").textContent.trim(), "0:10", "Reset also stops the timer");
    },
  },
  {
    name: "reaching zero stops and fires done once",
    async run({ mount, q, equal }) {
      const el = mount({ seconds: 2, tickMs: 100 });
      let done = 0;
      el.addEventListener("done", () => done++);
      q(el, "button.start").click();
      await sleep(600);
      equal(q(el, ".time").textContent.trim(), "0:00");
      equal(done, 1, "done fires exactly once");
      equal(q(el, "button.start").disabled, false, "The timer has stopped");
    },
  },
  {
    name: "clicking start twice doesn't double the speed",
    async run({ mount, q, equal }) {
      const el = mount({ seconds: 10, tickMs: 200 });
      const start = q(el, "button.start");
      start.click();
      start.disabled = false;
      start.click();
      await sleep(500);
      equal(q(el, ".time").textContent.trim(), "0:08", "Only one interval may run");
    },
  },
  {
    name: "stops when removed from the page",
    async run({ mount, q, equal }) {
      const el = mount({ seconds: 2, tickMs: 100 });
      let done = 0;
      el.addEventListener("done", () => done++);
      q(el, "button.start").click();
      el.remove();
      await sleep(500);
      equal(done, 0, "Clear the interval in disconnectedCallback");
    },
  },
];
