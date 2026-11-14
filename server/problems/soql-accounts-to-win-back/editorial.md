## Approach

Two subqueries on the same child object, one with `IN` and one with `NOT IN`:

```sql
SELECT Id, Name
FROM Account
WHERE Id IN (SELECT AccountId FROM Opportunity WHERE IsClosed = false)
  AND Id NOT IN (SELECT AccountId FROM Opportunity WHERE IsWon = true AND CloseDate = LAST_N_DAYS:365)
ORDER BY Name ASC
```

- `IsClosed = false` means the deal is still open; `IsWon = true` means Closed Won (stage names vary by org, these flags don't).
- `LAST_N_DAYS:365` covers today and the previous 365 days.
- An account can appear in both subqueries' sources; the anti-join removes it if it has a recent win.
