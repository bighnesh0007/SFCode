@isTest
private class SfcSoqlNoContactsTest {
    @isTest
    static void matchesReference() {
        Account lonely = new Account(Name = 'Lonely');
        Account busy = new Account(Name = 'Busy');
        Account empty = new Account(Name = 'Empty');
        insert new List<Account>{ lonely, busy, empty };
        insert new List<Contact>{ new Contact(LastName = 'A', AccountId = busy.Id), new Contact(LastName = 'B', AccountId = busy.Id) };
        Test.startTest();
        List<SObject> actual = sfcRunSubmission();
        Test.stopTest();
        List<SObject> expected = Database.query({{REFERENCE_QUERY}});
        System.assert(!expected.isEmpty(), 'Fixture sanity: the reference query must return rows');
        sfcAssertSameRows(expected, actual, false);
    }

{{SOQL_COMPARE}}
}
