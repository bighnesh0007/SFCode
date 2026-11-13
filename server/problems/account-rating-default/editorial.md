## Approach

The value has to be on the record *as it's saved*, so this is a **before insert** trigger. In before triggers the records in `Trigger.new` are the ones about to be written: assign to their fields and Salesforce saves the change, with no `update` statement and no extra DML.

Check both conditions. `String.isBlank(a.Rating)` is true for null and empty values, so a rating the user picked is left alone.

## Why it's bulk-safe

One loop over `Trigger.new` and no queries or DML: 200 accounts cost the same governor limits as one.

## Solution

**SfcAccountRating.trigger**

```apex
trigger SfcAccountRating on Account (before insert) {
    for (Account a : Trigger.new) {
        if (a.Industry == 'Technology' && String.isBlank(a.Rating)) {
            a.Rating = 'Hot';
        }
    }
}
```
