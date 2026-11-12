@isTest
private class SfcContactAccountNameTest {
    @isTest
    static void copiesAccountName() {
        Account a = new Account(Name = 'Acme');
        insert a;
        Contact c = new Contact(LastName = 'X', AccountId = a.Id);
        insert c;
        System.assertEquals('Acme', [SELECT Description FROM Contact WHERE Id = :c.Id].Description);
    }

    @isTest
    static void leavesContactsWithoutAccount() {
        Contact c = new Contact(LastName = 'Solo', Description = 'keep me');
        insert c;
        System.assertEquals('keep me', [SELECT Description FROM Contact WHERE Id = :c.Id].Description,
            'No account means no change');
    }

    @isTest
    static void survives200Contacts() {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < 150; i++) {
            accounts.add(new Account(Name = 'Acc ' + i));
        }
        insert accounts;
        List<Contact> contacts = new List<Contact>();
        for (Integer i = 0; i < 200; i++) {
            contacts.add(new Contact(LastName = 'C' + i, AccountId = accounts[Math.mod(i, 150)].Id));
        }
        Test.startTest();
        insert contacts;
        Integer queries = Limits.getQueries();
        Test.stopTest();
        System.assert(queries <= 2, 'The trigger should use a constant number of queries, used ' + queries);
        // Description is a long text area: not filterable in SOQL, so count in Apex.
        Integer named = 0;
        for (Contact c : [SELECT Description FROM Contact]) {
            if (c.Description != null && c.Description.startsWith('Acc ')) {
                named++;
            }
        }
        System.assertEquals(200, named, 'Every contact should carry its account name');
    }
}
