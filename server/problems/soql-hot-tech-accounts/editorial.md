## Approach

- Two equality filters joined by `AND`.
- `ORDER BY AnnualRevenue DESC NULLS LAST`: in SOQL, nulls come **first** by default when sorting descending, so `NULLS LAST` is needed to push unknown revenue to the bottom.
- `, Name ASC` makes ties come back in a stable, predictable order.

## Solution

**query.soql**

```sql
SELECT Id, Name, AnnualRevenue FROM Account WHERE Industry = 'Technology' AND Rating = 'Hot' ORDER BY AnnualRevenue DESC NULLS LAST, Name ASC
```
