const people = [
  { id: "1", name: "Ada Lovelace" },
  { id: "2", name: "Alan Turing" },
  { id: "3", name: "Grace Hopper" },
  { id: "4", name: "Katherine Johnson" },
  { id: "5", name: "Marc Benioff" },
];

async function search(el, q, flush, text) {
  const input = q(el, ".search");
  input.value = text;
  input.dispatchEvent(new CustomEvent("input"));
  await flush();
}

const tests = [
  {
    name: "lists every contact with no search",
    async run({ mount, qa, q, equal }) {
      const el = mount({ contacts: people });
      equal(qa(el, "li.contact").length, 5, "Expected one li.contact per contact");
      equal(q(el, ".summary")?.textContent, "5 of 5 contacts");
    },
  },
  {
    name: "filters case-insensitively, keeping order",
    async run({ mount, qa, q, flush, equal }) {
      const el = mount({ contacts: people });
      await search(el, q, flush, "AL");
      equal(qa(el, "li.contact").map((li) => li.textContent).join(", "), "Alan Turing", "\"AL\" should match only Alan Turing (case-insensitive)");
      await search(el, q, flush, "a");
      equal(qa(el, "li.contact").length, 5);
      await search(el, q, flush, "er");
      equal(qa(el, "li.contact").map((li) => li.textContent).join(", "), "Grace Hopper, Katherine Johnson");
      equal(q(el, ".summary").textContent, "2 of 5 contacts");
    },
  },
  {
    name: "shows the empty state when nothing matches",
    async run({ mount, qa, q, flush, equal, assert }) {
      const el = mount({ contacts: people });
      await search(el, q, flush, "zzz");
      equal(qa(el, "li.contact").length, 0);
      assert(q(el, ".empty")?.textContent === "No contacts match.", "Expected a .empty paragraph reading \"No contacts match.\"");
      equal(q(el, ".summary").textContent, "0 of 5 contacts");
    },
  },
  {
    name: "works with no contacts provided",
    async run({ mount, q, equal }) {
      const el = mount();
      equal(q(el, ".summary")?.textContent, "0 of 0 contacts");
    },
  },
];
