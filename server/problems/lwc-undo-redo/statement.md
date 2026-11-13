Build a `c-undo-list`: a list of notes with undo and redo.

- `<input class="new">` and `<button class="add">` add the trimmed text as a new
  `<li class="note">` at the end (blank text adds nothing) and clear the input.
- Each note has a `<button class="remove">` that deletes it.
- `<button class="undo">` reverts the last change (add or remove);
  `<button class="redo">` re-applies the last undone change. Each is `disabled`
  when there is nothing to undo or redo.
- Making a **new** change after undoing discards the redo history.
- **Ctrl+Z** and **Ctrl+Y** on the component do the same as the buttons.
