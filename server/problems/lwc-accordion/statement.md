Build a `c-faq-accordion` for an FAQ page.

- **`@api sections`**: an array of `{ id, title, body }` (default `[]`).
- **`@api allowMultiple`**: when `false` (the default), opening a section closes
  any other open one. When `true`, several can be open at once.
- For each section render a `<button class="header">` showing its title, with an
  **`aria-expanded`** attribute of `"true"` or `"false"`.
- When a section is open, render its body in a `<div class="body">` right after its
  header. Closed sections render no body.
- Clicking a header toggles that section. Everything starts closed.
