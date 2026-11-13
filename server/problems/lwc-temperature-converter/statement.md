Build a `c-temp-converter` with two linked inputs.

- `<input class="celsius">` and `<input class="fahrenheit">`, both `type="number"`.
- Typing in either one updates the other: °F = °C × 9/5 + 32, and °C = (°F − 32) × 5/9.
- Show converted values **rounded to one decimal place**, without a trailing `.0`
  (so `100` °C shows `212`, and `37` °C shows `98.6`).
- When an input is cleared (empty), clear the other one too.
- If the input isn't a number, leave the other input unchanged.
