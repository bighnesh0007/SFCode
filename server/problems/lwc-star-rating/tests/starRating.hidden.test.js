// Hidden tests: graded on the server when the learner submits. Includes every visible test.
const tests = [
  {
    name: "renders five stars, none selected by default",
    async run({ mount, qa, equal }) {
      const el = mount();
      equal(qa(el, "button.star").length, 5, "Expected five button.star elements");
      equal(qa(el, "button.star.selected").length, 0, "No star is selected when value is 0");
    },
  },
  {
    name: "selects stars up to value",
    async run({ mount, qa, equal }) {
      const el = mount({ value: 3 });
      const selected = qa(el, "button.star").map((b) => b.classList.contains("selected"));
      equal(selected.join(","), "true,true,true,false,false", "With value 3, stars 1–3 should be selected");
    },
  },
  {
    name: "dispatches rate with the star's number as detail",
    async run({ mount, qa, flush, equal }) {
      const el = mount({ value: 1 });
      const got = [];
      el.addEventListener("rate", (e) => got.push(e.detail));
      qa(el, "button.star")[3].click();
      qa(el, "button.star")[0].click();
      await flush();
      equal(got.join(","), "4,1", "Clicking star 4 then star 1 should dispatch rate with detail 4, then 1");
    },
  },
  {
    name: "doesn't change its own value (one-way data flow)",
    async run({ mount, qa, flush, equal }) {
      const el = mount({ value: 2 });
      qa(el, "button.star")[4].click();
      await flush();
      equal(qa(el, "button.star.selected").length, 2, "The parent owns value; clicking must not select stars by itself");
    },
  },

  {
    name: "value 5 selects every star",
    async run({ mount, qa, equal }) {
      const el = mount({ value: 5 });
      equal(qa(el, "button.star.selected").length, 5);
    },
  },
  {
    name: "re-renders when the parent changes value",
    async run({ mount, qa, flush, equal }) {
      const el = mount({ value: 4 });
      el.value = 1;
      await flush();
      equal(qa(el, "button.star.selected").length, 1, "value is a public (@api) property: the parent changing it must re-render");
    },
  },
  {
    name: "every star reports its own number",
    async run({ mount, qa, flush, equal }) {
      const el = mount();
      const got = [];
      el.addEventListener("rate", (e) => got.push(e.detail));
      for (const b of qa(el, "button.star")) b.click();
      await flush();
      equal(got.join(","), "1,2,3,4,5");
    },
  },
];
