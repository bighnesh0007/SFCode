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
];
