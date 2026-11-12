Sales wants to know which accounts have a lot going on: **two or more open opportunities**.

Return one row per account with exactly these columns:

| Column | Meaning |
|---|---|
| `AccountId` | the account |
| `openDeals` | how many of its opportunities are still **open** |

- Count only open opportunities (`IsClosed` is false); won and lost deals don't count.
- Keep only accounts with **at least 2** open opportunities.
- Use the alias **`openDeals`** exactly. Order does not matter.

> Filtering on an aggregate needs `HAVING`, not `WHERE`.
>
> Write a single SOQL query — no bind variables and no trailing semicolon.
