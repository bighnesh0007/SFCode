For each Account that has **at least one `Closed Won` opportunity**, return the
account with its won deals nested inside it.

- Account fields: exactly `Id`, `Name`
- Nested **`Opportunities`** (child relationship): exactly `Id`, `Amount`, **only
  `Closed Won`** ones, largest `Amount` first
- Accounts without a won deal must **not** appear at all
- Order accounts by `Name` ascending

**Order matters** — of the accounts and of the nested opportunities.

> Write a single SOQL query — no bind variables and no trailing semicolon.
