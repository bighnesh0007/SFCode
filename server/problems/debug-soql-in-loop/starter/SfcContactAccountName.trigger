trigger SfcContactAccountName on Contact (before insert) {
    for (Contact c : Trigger.new) {
        if (c.AccountId != null) {
            Account a = [SELECT Name FROM Account WHERE Id = :c.AccountId];
            c.Description = a.Name;
        }
    }
}
