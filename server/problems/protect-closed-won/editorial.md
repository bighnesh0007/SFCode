## Approach

`addError` on a record in a **before** trigger stops that record's DML and shows the message to the user, or returns it to the API caller. For deletes, the records live in `Trigger.old`.

Only Closed Won records get the error, so in a mixed delete (with `allOrNone=false`) the others still go through.

## Why not a validation rule?

Validation rules don't run on delete. A before-delete trigger is the standard way to protect records from deletion.

## Solution

**SfcProtectClosedWon.trigger**

```apex
trigger SfcProtectClosedWon on Opportunity (before delete) {
    for (Opportunity o : Trigger.old) {
        if (o.StageName == 'Closed Won') {
            o.addError('Closed Won opportunities cannot be deleted.');
        }
    }
}
```
