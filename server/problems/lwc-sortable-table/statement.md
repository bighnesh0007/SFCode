Build a `c-deal-table` that shows deals a page at a time and sorts by column.

- **`@api rows`**: an array of `{ id, name, amount }` (default `[]`). Don't modify it.
- **`@api pageSize`**: rows per page (default **5**).
- One `<tr class="row">` per visible deal, with a `<td class="name">` and a
  `<td class="amount">`.
- Two header buttons: `<button class="sort" data-field="name">` and
  `<button class="sort" data-field="amount">`.
  - Clicking a column sorts ascending by it; clicking the **same** column again
    flips to descending. Clicking the other column starts it ascending.
  - Names sort **case-insensitively**; amounts sort as numbers. Equal values keep
    their original order.
  - Sorting returns to page 1.
- Paging: `<button class="prev">`, `<button class="next">` and
  `<p class="page">Page X of Y</p>`. Prev is `disabled` on the first page, Next on
  the last. With no rows it reads `Page 1 of 1`.
- Before any sort click, rows appear in the order given.
