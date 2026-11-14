## Approach

```sql
SELECT CALENDAR_MONTH(CloseDate) month, SUM(Amount) total, COUNT(Id) deals
FROM Opportunity
WHERE IsWon = true AND CloseDate = THIS_YEAR
GROUP BY CALENDAR_MONTH(CloseDate)
ORDER BY CALENDAR_MONTH(CloseDate)
```

- **Date functions** (`CALENDAR_MONTH`, `CALENDAR_YEAR`, `FISCAL_QUARTER`, `DAY_IN_WEEK`…) can be selected and grouped on.
- `IsWon` is safer than a stage name: stage labels differ between orgs.
- In `ORDER BY`, repeat the function; SOQL doesn't accept the alias there.
- Without a `GROUP BY` on the month, you'd get one row for the whole year.
