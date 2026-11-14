## What's wrong

Batch Apex runs `start`, every `execute` and `finish` as **separate transactions**. By default each one gets the batch object as it was originally serialized, so `ratedHot` is back at **0** in `finish()`, whatever `execute()` counted.

## The fix

Implement **`Database.Stateful`**:

```apex
public with sharing class SfcRatingBatch implements Database.Batchable<SObject>, Database.Stateful {
```

With it, instance variables are carried from one transaction to the next, so `finish()` sees the running total.

**Use it sparingly:** stateful batches serialize their state between chunks, which costs time and heap. Keep only small values (counters, a few Ids or error messages), never whole record lists.
