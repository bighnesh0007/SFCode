// Hidden tests: graded on the server when the learner submits. Includes every visible test.
const FAQ = [
  { id: "ship", title: "How long does shipping take?", body: "2 to 4 business days." },
  { id: "refund", title: "When do refunds arrive?", body: "Within 5 days." },
  { id: "cancel", title: "Can I cancel my plan?", body: "Yes, from your profile." },
];

const tests = [
  {
    name: "renders a closed header per section",
    async run({ mount, qa, equal }) {
      const el = mount({ sections: FAQ });
      const headers = qa(el, "button.header");
      equal(headers.length, 3, "One button.header per section");
      equal(headers.map((h) => h.getAttribute("aria-expanded")).join(","), "false,false,false", "Everything starts closed");
      equal(qa(el, ".body").length, 0, "Closed sections render no body");
    },
  },
  {
    name: "clicking a header opens it",
    async run({ mount, qa, flush, equal }) {
      const el = mount({ sections: FAQ });
      qa(el, "button.header")[1].click();
      await flush();
      equal(qa(el, "button.header")[1].getAttribute("aria-expanded"), "true");
      equal(qa(el, ".body").map((b) => b.textContent.trim()).join("|"), "Within 5 days.");
    },
  },
  {
    name: "opening one closes the other by default",
    async run({ mount, qa, flush, equal }) {
      const el = mount({ sections: FAQ });
      qa(el, "button.header")[0].click();
      await flush();
      qa(el, "button.header")[2].click();
      await flush();
      equal(qa(el, "button.header").map((h) => h.getAttribute("aria-expanded")).join(","), "false,false,true");
      equal(qa(el, ".body").length, 1, "Only one body at a time");
    },
  },
  {
    name: "allowMultiple keeps several open",
    async run({ mount, qa, flush, equal }) {
      const el = mount({ sections: FAQ, allowMultiple: true });
      qa(el, "button.header")[0].click();
      await flush();
      qa(el, "button.header")[2].click();
      await flush();
      equal(qa(el, ".body").length, 2);
    },
  },
  {
    name: "clicking an open header closes it",
    async run({ mount, qa, flush, equal }) {
      const el = mount({ sections: FAQ });
      qa(el, "button.header")[0].click();
      await flush();
      qa(el, "button.header")[0].click();
      await flush();
      equal(qa(el, "button.header")[0].getAttribute("aria-expanded"), "false");
      equal(qa(el, ".body").length, 0);
    },
  },
  {
    name: "the body follows its own header",
    async run({ mount, qa, flush, equal }) {
      const el = mount({ sections: FAQ });
      qa(el, "button.header")[2].click();
      await flush();
      const header = qa(el, "button.header")[2];
      const body = qa(el, ".body")[0];
      equal(Boolean(header.compareDocumentPosition(body) & 4), true, "The open body comes after its header in the page");
      equal(body.textContent.trim(), "Yes, from your profile.");
    },
  },
];
