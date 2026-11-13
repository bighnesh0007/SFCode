## Approach

Same shape as every field-defaulting trigger: **before insert**, loop over `Trigger.new`, assign.

- `containsIgnoreCase` handles *Urgent*, *URGENT* and *urgent* in one call. Lower-casing both sides works too.
- Calling a method on a null `Subject` throws a `NullPointerException`, so check for null first.
- No queries and no DML, so 200 cases cost no more than one.

## Solution

```apex
trigger SfcCaseUrgency on Case (before insert) {
    for (Case c : Trigger.new) {
        if (c.Subject != null && c.Subject.containsIgnoreCase('urgent')) {
            c.Priority = 'High';
        }
    }
}
```
