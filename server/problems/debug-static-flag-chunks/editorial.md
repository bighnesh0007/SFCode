## What's wrong

Triggers process at most **200 records per invocation**. A single DML of 400 records fires the trigger **twice in the same transaction**. Static variables last for the whole transaction, so the `hasRun` flag set by the first chunk silently skips the second.

## The fix

Guard **per record**, not per transaction:

```apex
public class SfcLeadScorer {
    private static Set<Id> scored = new Set<Id>();

    public static void score(List<Lead> leads) {
        for (Lead l : leads) {
            if (l.Id != null && scored.contains(l.Id)) continue;
            l.Rating = (l.AnnualRevenue != null && l.AnnualRevenue > 1000000) ? 'Hot' : 'Warm';
            if (l.Id != null) scored.add(l.Id);
        }
    }
}
```

New records have no Id in before insert, and each can only be inserted once, so they're always scored. Updated records are tracked by Id, so a recursive update in the same transaction doesn't score them again.

**Rule of thumb:** a static `Boolean` recursion guard is almost always a bug. Use a `Set<Id>` of processed records.
