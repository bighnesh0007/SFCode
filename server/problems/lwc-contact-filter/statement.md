Build a `c-contact-filter` component that filters a list as the user types.

- A public property **`contacts`**: an array of `{ id, name }` (default empty).
- An `<input>` with class **`search`**. Filter on its **`input`** event.
- One `<li class="contact">` per contact whose **name contains the search text,
  ignoring case**, in the original order.
- A paragraph with class **`summary`** reading `N of M contacts`, e.g. `2 of 5 contacts`.
- When nothing matches, **no** `li.contact` elements, and a paragraph with class
  **`empty`** reading `No contacts match.`

*Hint:* a getter that returns the filtered array keeps the template simple.
