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
