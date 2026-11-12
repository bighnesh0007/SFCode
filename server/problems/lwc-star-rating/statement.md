Build a `c-star-rating` component that a parent uses like
`<c-star-rating value={rating} onrate={handleRate}>`.

- A public property **`value`**: the current rating, 0–5 (default **0**).
- Five `<button>` elements with class **`star`**, in order 1 to 5. A star whose
  number is **≤ `value`** also has the class **`selected`**.
- Clicking star *n* dispatches a **`rate`** event whose **`detail`** is the
  number *n*. The component does **not** change `value` itself; the parent
  decides (one-way data flow).

*Hint:* build an array of `{ n, className }` in a getter and loop over it with `for:each`.
