Build a small to-do list.

- `<input class="new-item">` and `<button class="add">Add</button>`. Clicking **Add**
  appends the input's text, **trimmed**, and clears the input. Blank text adds nothing.
- Each item renders as `<li class="item">` with the text in `<span class="text">`
  and a `<button class="remove">` that deletes that item.
- Clicking an item's `.text` toggles it done: the `<li>` then also has the class `done`.
- A `<p class="summary">` reads `N of M done`.
- An optional public property `items`, an array of strings, seeds the list
  when the component is created.
