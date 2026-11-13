Typing in a search box shouldn't fire a server call on every keystroke. Build a
`c-debounced-search` that waits for the user to pause.

- An `<input class="search">`. Listen to its `input` event.
- **`@api delay`**: milliseconds of quiet to wait (default **300**).
- When the user stops typing for `delay` ms, dispatch a **`search`** event whose
  `detail` is the **trimmed** text. Each keystroke restarts the wait, so a burst of
  typing produces **one** event, for the final text.
- Don't dispatch when the trimmed text is empty, or when it's the same as the
  last term you dispatched.
- While a search is waiting, show `<span class="pending">Searching…</span>`;
  remove it once the wait ends.
- If the component is removed from the page while waiting, the event must
  **never** fire.
