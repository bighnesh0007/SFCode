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
];
