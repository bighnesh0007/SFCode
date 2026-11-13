Build a `c-password-strength` that rates a password as the user types.

- An `<input class="password" type="password">`. Listen to its `input` event.
- Four rules, each worth a point:
  1. at least 8 characters;
  2. both upper- and lower-case letters;
  3. at least one digit;
  4. at least one symbol (any character that isn't a letter or digit).
- Show `<p class="strength">` with **Weak** (0–1 points), **Medium** (2–3) or
  **Strong** (4). Give it the class `weak`, `medium` or `strong` as well.
- List each rule that isn't met yet as an `<li class="rule">`, using exactly these
  texts: `At least 8 characters`, `Upper and lower case letters`, `A number`,
  `A symbol`.
- While the input is empty, show neither the strength nor the rules.
