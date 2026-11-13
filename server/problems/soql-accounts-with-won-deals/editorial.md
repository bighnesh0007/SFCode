## Approach

The child subquery's filter only limits **which children** come back: an account with no won deals would still appear, with an empty list. That's why there's also a **semi-join** in the outer WHERE.

- `(SELECT Id, Amount FROM Opportunities WHERE StageName = 'Closed Won' ORDER BY Amount DESC)` uses the child relationship name, which is plural.
- `WHERE Id IN (SELECT AccountId FROM Opportunity WHERE StageName = 'Closed Won')`
- `ORDER BY Name ASC` for the parents.

## Solution

**query.soql**

```sql
SELECT Id, Name, (SELECT Id, Amount FROM Opportunities WHERE StageName = 'Closed Won' ORDER BY Amount DESC) FROM Account WHERE Id IN (SELECT AccountId FROM Opportunity WHERE StageName = 'Closed Won') ORDER BY Name ASC
```
