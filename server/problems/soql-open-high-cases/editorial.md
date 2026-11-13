## Approach

`IsClosed` is true for every status marked closed, whatever an org calls them, so prefer it to `Status != 'Closed'`. Combine it with the priority filter using `AND`, and sort with `ORDER BY Subject ASC`.

## Solution

```sql
SELECT Id, Subject, Priority FROM Case WHERE IsClosed = false AND Priority = 'High' ORDER BY Subject ASC
```
