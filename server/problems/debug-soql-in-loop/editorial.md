## What was wrong

The trigger queried the account **inside** the loop. With 101 contacts in one insert, the 101st query throws `Too many SOQL queries: 101`.

## The fix: collect, query once, map

1. Loop once and collect the account ids into a set, skipping nulls.
2. Query all those accounts at once with `IN :accountIds`.
3. `new Map<Id, Account>(query)` indexes them by id.
4. Loop again and look each one up.

This is the most important pattern in Apex: it turns N queries into one.

## Solution

**SfcContactAccountName.trigger**

```apex
trigger SfcContactAccountName on Contact (before insert) {
    Set<Id> accountIds = new Set<Id>();
    for (Contact c : Trigger.new) {
        if (c.AccountId != null) {
            accountIds.add(c.AccountId);
        }
    }
    if (accountIds.isEmpty()) {
        return;
    }
    Map<Id, Account> accounts = new Map<Id, Account>([SELECT Name FROM Account WHERE Id IN :accountIds]);
    for (Contact c : Trigger.new) {
        if (c.AccountId != null && accounts.containsKey(c.AccountId)) {
            c.Description = accounts.get(c.AccountId).Name;
        }
    }
}
```
