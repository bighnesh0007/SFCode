Build a `c-show-more` that hides long text until the reader asks for it.

- **`@api text`**: the full text (default `""`).
- **`@api limit`**: how many characters to show while collapsed (default **100**).
- Show the text in `<p class="text">`. While collapsed, show only the first `limit`
  characters followed by `…` (a single ellipsis character).
- A `<button class="toggle">` reads **Show more** while collapsed and **Show less**
  while expanded, with `aria-expanded` set to `"false"` or `"true"`.
- If the text fits within `limit`, show it in full and render **no** button.
