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
