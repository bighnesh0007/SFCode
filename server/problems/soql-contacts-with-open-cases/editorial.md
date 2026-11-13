## Approach

A **semi-join** (`Id IN (subquery)`) filters contacts by whether a related case exists. Each contact comes back once, however many cases match, which a query on Case can't give you.

The subquery must select a single Id or reference field, here `ContactId`.

## Solution

```sql
SELECT Id, FirstName, LastName FROM Contact WHERE Id IN (SELECT ContactId FROM Case WHERE IsClosed = false)
```
