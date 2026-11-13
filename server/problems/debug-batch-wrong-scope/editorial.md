## What was wrong

Two bugs in `execute`:

1. **Wrong records changed.** The loop queried a *fresh copy* of each lead and set the rating on the copy, but `update scope` saved the **original** records, which had no change. Nothing was ever updated.
2. **SOQL in a loop.** One query per record. A 200-record chunk makes 200 queries, and the limit is 100.

## The fix

`scope` already contains the records from `start`, with the fields it selected. Change them directly, then save them with one `update`.

## Lesson

In Batch Apex, `start` does the querying. `execute` should almost never query the same records again.
