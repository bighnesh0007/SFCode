## Approach

A single aggregate query can compute several aggregates per group. `GROUP BY StageName` gives one row per stage, with `COUNT(Id) total` and `SUM(Amount) amount` beside it.

`SUM` ignores null amounts. A stage where every amount is blank sums to null, not 0.

## Solution

**query.soql**

```sql
SELECT StageName, COUNT(Id) total, SUM(Amount) amount FROM Opportunity GROUP BY StageName
```
