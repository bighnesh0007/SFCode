## Approach

Recompute the total rather than adding or subtracting deltas: it's simpler and can't drift.

1. **Which accounts changed?** New records' accounts, plus old records' accounts on update and delete, because re-parenting an opportunity changes two totals. Drop nulls.
2. **One aggregate query** sums Closed Won amounts per account.
3. Start every affected account at **0**, so an account whose last won deal was deleted is reset rather than skipped.
4. **One update** of the accounts.

Keeping the logic in a handler class keeps the trigger thin and the logic testable.

## Solution

**SfcRevenueRollup.trigger**

```apex
trigger SfcRevenueRollup on Opportunity (after insert, after update, after delete, after undelete) {
    Set<Id> accountIds = new Set<Id>();
    for (Opportunity o : Trigger.isDelete ? Trigger.old : Trigger.new) {
        accountIds.add(o.AccountId);
    }
    if (Trigger.isUpdate) {
        for (Opportunity o : Trigger.old) {
            accountIds.add(o.AccountId);
        }
    }
    accountIds.remove(null);
    SfcRevenueRollupHandler.recalculate(accountIds);
}
```

**SfcRevenueRollupHandler.cls**

```apex
public with sharing class SfcRevenueRollupHandler {
    public static void recalculate(Set<Id> accountIds) {
        if (accountIds.isEmpty()) {
            return;
        }
        Map<Id, Decimal> totals = new Map<Id, Decimal>();
        for (Id accountId : accountIds) {
            totals.put(accountId, 0);
        }
        for (AggregateResult r : [
            SELECT AccountId, SUM(Amount) total
            FROM Opportunity
            WHERE AccountId IN :accountIds AND StageName = 'Closed Won'
            GROUP BY AccountId
        ]) {
            Decimal total = (Decimal) r.get('total');
            totals.put((Id) r.get('AccountId'), total == null ? 0 : total);
        }
        List<Account> updates = new List<Account>();
        for (Id accountId : totals.keySet()) {
            updates.add(new Account(Id = accountId, AnnualRevenue = totals.get(accountId)));
        }
        update updates;
    }
}
```
