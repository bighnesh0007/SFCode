Build a `textarea` with a live character count, like a tweet box.

- A public property `max` (default **140**).
- A `<textarea class="input">` the user types in.
- A `<p class="counter">` showing `used/max`, for example `12/140`.
- When the text is **longer than** `max`, the counter also gets the class `over`.
  At exactly `max` it doesn't.
- A `<p class="remaining">` reading `N characters left`, or `N characters over`
  when past the limit. Use `character` for exactly one, e.g. `1 character left`.
