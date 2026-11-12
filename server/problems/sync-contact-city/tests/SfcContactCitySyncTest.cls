@isTest
private class SfcContactCitySyncTest {
    @isTest
    static void copiesBillingCityToContacts() {
        Account moved = new Account(Name = 'Moved', BillingCity = 'Pune');
        Account other = new Account(Name = 'Other', BillingCity = 'Delhi');
        insert new List<Account>{ moved, other };
        List<Contact> contacts = new List<Contact>();
        for (Integer i = 0; i < 50; i++) {
            contacts.add(new Contact(LastName = 'M' + i, AccountId = moved.Id, MailingCity = 'Old'));
        }
        Contact untouched = new Contact(LastName = 'O', AccountId = other.Id, MailingCity = 'Old');
        contacts.add(untouched);
        insert contacts;

        Test.startTest();
        System.enqueueJob(new SfcContactCitySync(new Set<Id>{ moved.Id }));
        Test.stopTest();

        System.assertEquals(50, [SELECT COUNT() FROM Contact WHERE AccountId = :moved.Id AND MailingCity = 'Pune'],
            'Every contact of the moved account should now be in Pune');
        System.assertEquals('Old', [SELECT MailingCity FROM Contact WHERE Id = :untouched.Id].MailingCity,
            'Contacts of other accounts must not change');
    }
}
