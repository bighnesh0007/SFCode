## Approach

Aggregate queries return `AggregateResult` rows, one per group.

- `WHERE IsClosed = false` drops closed deals **before** grouping.
- `GROUP BY AccountId` makes one row per account.
- `HAVING COUNT(Id) >= 2` keeps groups with at least two. Aggregates can't go in WHERE, which is what HAVING is for.
- The alias `openDeals` is how Apex reads the value: `(Integer) ar.get('openDeals')`.

## Solution

**query.soql**

```sql
SELECT AccountId, COUNT(Id) openDeals FROM Opportunity WHERE IsClosed = false GROUP BY AccountId HAVING COUNT(Id) >= 2
```
