// Hidden tests: graded on the server when the learner submits. Includes every visible test.
const deals = [
  { id: "1", name: "Globex", amount: 500 },
  { id: "2", name: "acme", amount: 1200 },
  { id: "3", name: "Initech", amount: 90 },
  { id: "4", name: "Umbrella", amount: 3000 },
  { id: "5", name: "Hooli", amount: 1200 },
  { id: "6", name: "Stark", amount: 15 },
  { id: "7", name: "Wayne", amount: 700 },
];
const names = (el, qa) => qa(el, "tr.row td.name").map((td) => td.textContent.trim()).join(",");

const tests = [
  {
    name: "shows the first page in the order given",
    async run({ mount, q, qa, equal }) {
      const el = mount({ rows: deals });
      equal(names(el, qa), "Globex,acme,Initech,Umbrella,Hooli", "Page 1 should hold the first five deals, unsorted");
      equal(q(el, "p.page").textContent.trim(), "Page 1 of 2");
      equal(q(el, "button.prev").disabled, true, "Prev is disabled on page 1");
    },
  },
  {
    name: "sorts by name ascending, case-insensitively",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount({ rows: deals, pageSize: 10 });
      q(el, 'button.sort[data-field="name"]').click();
      await flush();
      equal(names(el, qa), "acme,Globex,Hooli,Initech,Stark,Umbrella,Wayne", "'acme' sorts first even though it's lower-case");
    },
  },
  {
    name: "a second click on the same column sorts descending",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount({ rows: deals, pageSize: 10 });
      const amount = q(el, 'button.sort[data-field="amount"]');
      amount.click();
      await flush();
      amount.click();
      await flush();
      equal(qa(el, "tr.row td.amount").map((td) => td.textContent.trim()).join(","), "3000,1200,1200,700,500,90,15");
    },
  },
  {
    name: "pages forward and back, with Next disabled on the last page",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount({ rows: deals });
      q(el, "button.next").click();
      await flush();
      equal(names(el, qa), "Stark,Wayne", "Page 2 holds the remaining two deals");
      equal(q(el, "p.page").textContent.trim(), "Page 2 of 2");
      equal(q(el, "button.next").disabled, true, "Next is disabled on the last page");
      q(el, "button.prev").click();
      await flush();
      equal(q(el, "p.page").textContent.trim(), "Page 1 of 2");
    },
  },
  {
    name: "sorting returns to page 1",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount({ rows: deals });
      q(el, "button.next").click();
      await flush();
      q(el, 'button.sort[data-field="amount"]').click();
      await flush();
      equal(q(el, "p.page").textContent.trim(), "Page 1 of 2");
      equal(names(el, qa), "Stark,Initech,Globex,Wayne,acme", "Cheapest five, on page 1");
    },
  },
  {
    name: "ties keep their original order (stable sort)",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount({ rows: deals, pageSize: 10 });
      q(el, 'button.sort[data-field="amount"]').click();
      await flush();
      equal(names(el, qa).split(",").slice(4, 6).join(","), "acme,Hooli", "acme and Hooli both have 1200; acme came first");
    },
  },
  {
    name: "switching columns starts the new one ascending",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount({ rows: deals, pageSize: 10 });
      q(el, 'button.sort[data-field="name"]').click();
      await flush();
      q(el, 'button.sort[data-field="name"]').click();
      await flush();
      q(el, 'button.sort[data-field="amount"]').click();
      await flush();
      equal(qa(el, "tr.row td.amount")[0].textContent.trim(), "15", "A fresh column sorts ascending");
    },
  },
  {
    name: "doesn't modify the rows it was given",
    async run({ mount, q, flush, equal }) {
      const rows = deals.map((d) => ({ ...d }));
      const el = mount({ rows });
      q(el, 'button.sort[data-field="amount"]').click();
      await flush();
      equal(rows.map((r) => r.id).join(","), "1,2,3,4,5,6,7", "Sort a copy; the parent's array must keep its order");
    },
  },
  {
    name: "no rows means one empty page",
    async run({ mount, q, qa, equal }) {
      const el = mount();
      equal(qa(el, "tr.row").length, 0);
      equal(q(el, "p.page").textContent.trim(), "Page 1 of 1");
      equal(q(el, "button.next").disabled, true);
    },
  },
];
