## Approach

SOQL has no `LEFT JOIN ... WHERE x IS NULL`. Instead it has **anti-joins**: `Id NOT IN (subquery)`, where the subquery returns a single Id field.

The subquery lists every account that has a contact, and the outer query keeps the rest.

## Notes

Anti-joins and semi-joins (`IN (SELECT ...)`) are allowed on Id and reference fields. A query can have up to two of them in its WHERE clause.

## Solution

**query.soql**

```sql
SELECT Id, Name FROM Account WHERE Id NOT IN (SELECT AccountId FROM Contact)
```
