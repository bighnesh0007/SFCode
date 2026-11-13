Build a `c-cart-summary` that lets shoppers change quantities.

- **`@api items`**: an array of `{ id, name, price, quantity }`. Don't modify the
  parent's array or objects; keep your own copy.
- For each item render an `<li class="item">` containing `.name`, `.qty` (the
  quantity), a `<button class="inc">`, a `<button class="dec">` and `.subtotal`
  (price × quantity, with **two decimals**, e.g. `7.50`).
- **Inc** adds one. **Dec** removes one; at quantity 1 it removes the item.
- Show `<p class="total">Total: 12.50</p>` (two decimals).
- With no items, show `<p class="empty">Your cart is empty</p>` and no total.
- After every change, dispatch a **`change`** event whose `detail` is an array of
  `{ id, quantity }` for the items left, in order.
