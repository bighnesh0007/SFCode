Sales wants accounts that are **still in play but haven't bought recently**:
accounts that have **at least one open opportunity** but **no opportunity won in
the last 365 days**.

Return `Id` and `Name`, ordered by `Name` ascending.

- An account with an open deal and a win **older than 365 days** is included.
- An account with an open deal and a win **within 365 days** is excluded.
- An account with **no open deal** is excluded, whatever its history.

> Write a single SOQL query — no bind variables and no trailing semicolon.
