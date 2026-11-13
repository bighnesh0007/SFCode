## What was wrong

The trigger ran **after update** and then issued its own `update`, which fired the trigger again: an infinite loop that Salesforce stops at 16 levels with "maximum trigger depth exceeded".

## The fix

This trigger only changes fields on the records being saved, which is what **before** triggers are for. Switch to `before update` and assign to `Trigger.new`. There's no DML, so nothing can recurse.

## When you do need after-save logic

If you really need an after trigger that writes back, use a static Boolean or Set<Id> guard. Prefer moving same-record updates into a before trigger whenever you can.

## Solution

**SfcAccountStamp.trigger**

```apex
trigger SfcAccountStamp on Account (before update) {
    for (Account a : Trigger.new) {
        a.Description = 'Reviewed';
    }
}
```
