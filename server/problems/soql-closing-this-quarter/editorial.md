## Approach

**Date literals** are relative ranges that Salesforce resolves when the query runs. `CloseDate = THIS_QUARTER` means "between the first and last day of the current quarter", with no date maths in Apex and no edge cases at quarter boundaries.

Others worth knowing: `TODAY`, `YESTERDAY`, `LAST_N_DAYS:n`, `NEXT_N_DAYS:n`, `THIS_MONTH`, `LAST_YEAR`, `THIS_FISCAL_QUARTER`. Quarters follow the calendar here; the `FISCAL` variants use the org's fiscal year.

## Solution

```sql
SELECT Id, Name, Amount, CloseDate FROM Opportunity WHERE IsClosed = false AND CloseDate = THIS_QUARTER
```
