Build a three-step `c-signup-wizard`.

- `<p class="step">Step N of 3</p>` always shows the current step.
- **Step 1:** `<input class="name">`. **Step 2:** `<input class="email">`.
  **Step 3:** a review, `<p class="review">Name: {name}, Email: {email}</p>`, and a
  `<button class="submit">`.
- `<button class="next">` on steps 1 and 2; `<button class="back">` on steps 2
  and 3 (not on step 1).
- **Next validates the current step** and stays put if it's invalid, showing
  `<p class="error">` with a message:
  - step 1: the trimmed name must not be empty;
  - step 2: the trimmed email must look like `x@y.z` (no spaces, one `@`,
    a dot after it).
- The error disappears as soon as a step passes or the user goes back.
- **Back keeps what was typed**: returning to a step shows its earlier value.
- Submit dispatches a **`submit`** event with `detail` `{ name, email }`, both
  trimmed.
