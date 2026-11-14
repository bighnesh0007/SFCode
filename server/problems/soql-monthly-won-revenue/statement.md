Finance wants this year's **won** revenue by calendar month.

Return one row per month that has won deals, with:

- `month`: the calendar month number of `CloseDate` (1–12),
- `total`: the sum of `Amount`,
- `deals`: the number of won opportunities,

for opportunities that are **won** (`IsWon = true`) with a `CloseDate` **this
year**, ordered by month ascending.

> Write a single SOQL query — no bind variables and no trailing semicolon.
