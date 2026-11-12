@isTest
private class SfcSoqlContactsCityTest {
    @isTest
    static void matchesReference() {
        Account pune = new Account(Name = 'Pune Co', BillingCity = 'Pune');
        Account delhi = new Account(Name = 'Delhi Co', BillingCity = 'Delhi');
        insert new List<Account>{ pune, delhi };
        insert new List<Contact>{
            new Contact(LastName = 'Kulkarni', AccountId = pune.Id),
            new Contact(LastName = 'Joshi', AccountId = pune.Id),
            new Contact(LastName = 'Sharma', AccountId = delhi.Id),
            new Contact(LastName = 'Orphan')
        };
        Test.startTest();
        List<SObject> actual = sfcRunSubmission();
        Test.stopTest();
        List<SObject> expected = Database.query({{REFERENCE_QUERY}});
        System.assert(!expected.isEmpty(), 'Fixture sanity: the reference query must return rows');
        sfcAssertSameRows(expected, actual, false);
    }

{{SOQL_COMPARE}}
}
