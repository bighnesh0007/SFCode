Summarise the opportunity pipeline **per stage**.

Return one row per `StageName` with exactly these columns:

| Column | Meaning |
|---|---|
| `StageName` | the stage |
| `total` | number of opportunities in that stage |
| `amount` | sum of their `Amount` |

Use the aliases **`total`** and **`amount`** exactly. Order does not matter.

> Write a single SOQL query — no bind variables and no trailing semicolon.
