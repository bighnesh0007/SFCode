## What was wrong

The original code called `update` inside the loop: one DML statement per task. At 151 tasks the transaction hits the 150-statement limit and throws `System.LimitException`, which can't be caught.

## The fix

Change the records in memory inside the loop, then save them all with **one** `update` after it. One statement can update up to 10,000 records.

The same rule applies to `insert`, `delete` and `upsert`: collect first, then do one DML statement.

## Solution

**SfcTaskCloser.cls**

```apex
public with sharing class SfcTaskCloser {
    public static void closeAll(List<Task> tasks) {
        if (tasks == null || tasks.isEmpty()) {
            return;
        }
        for (Task t : tasks) {
            t.Status = 'Completed';
        }
        // One DML statement for the whole list, however long it is.
        update tasks;
    }
}
```
