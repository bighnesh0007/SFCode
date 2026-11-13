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
];
