// Hidden tests: graded on the server when the learner submits. Includes every visible test.
async function add(el, q, flush, text) {
  const input = q(el, "input.new");
  input.value = text;
  input.dispatchEvent(new CustomEvent("input"));
  await flush();
  q(el, "button.add").click();
  await flush();
}
const texts = (el, qa) => qa(el, "li.note .label").map((s) => s.textContent.trim()).join(",");

const tests = [
  {
    name: "adds trimmed notes and clears the input",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount();
      await add(el, q, flush, "  Buy milk ");
      equal(q(el, "input.new").value, "", "The input clears after adding");
      await add(el, q, flush, "   ");
      equal(texts(el, qa), "Buy milk", "Blank text adds nothing");
    },
  },
  {
    name: "undo and redo an add",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount();
      equal(q(el, "button.undo").disabled, true, "Nothing to undo yet");
      await add(el, q, flush, "One");
      await add(el, q, flush, "Two");
      q(el, "button.undo").click();
      await flush();
      equal(texts(el, qa), "One");
      q(el, "button.redo").click();
      await flush();
      equal(texts(el, qa), "One,Two");
      equal(q(el, "button.redo").disabled, true);
    },
  },
  {
    name: "undo restores a removed note",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount();
      await add(el, q, flush, "One");
      await add(el, q, flush, "Two");
      await add(el, q, flush, "Three");
      qa(el, "button.remove")[1].click();
      await flush();
      equal(texts(el, qa), "One,Three");
      q(el, "button.undo").click();
      await flush();
      equal(texts(el, qa), "One,Two,Three", "The note comes back in its place");
    },
  },
  {
    name: "a new change after undo discards redo",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount();
      await add(el, q, flush, "One");
      await add(el, q, flush, "Two");
      q(el, "button.undo").click();
      await flush();
      await add(el, q, flush, "Three");
      equal(q(el, "button.redo").disabled, true);
      equal(texts(el, qa), "One,Three");
    },
  },
  {
    name: "undo all the way back, then redo all the way forward",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount();
      for (const t of ["a", "b", "c"]) await add(el, q, flush, t);
      for (let i = 0; i < 3; i++) {
        q(el, "button.undo").click();
        await flush();
      }
      equal(texts(el, qa), "");
      equal(q(el, "button.undo").disabled, true);
      for (let i = 0; i < 3; i++) {
        q(el, "button.redo").click();
        await flush();
      }
      equal(texts(el, qa), "a,b,c");
    },
  },
  {
    name: "Ctrl+Z and Ctrl+Y work too",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount();
      await add(el, q, flush, "One");
      await add(el, q, flush, "Two");
      const target = q(el, "input.new");
      target.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, composed: true }));
      await flush();
      equal(texts(el, qa), "One");
      target.dispatchEvent(new KeyboardEvent("keydown", { key: "y", ctrlKey: true, bubbles: true, composed: true }));
      await flush();
      equal(texts(el, qa), "One,Two");
    },
  },
  {
    name: "duplicate notes are removed one at a time",
    async run({ mount, q, qa, flush, equal }) {
      const el = mount();
      await add(el, q, flush, "Same");
      await add(el, q, flush, "Same");
      qa(el, "button.remove")[0].click();
      await flush();
      equal(qa(el, "li.note").length, 1, "Removing one 'Same' must leave the other");
    },
  },
];
