@isTest
private class SfcSoqlContactsOpenCasesTest {
    @isTest
    static void matchesReference() {
        Contact ana = new Contact(FirstName = 'Ana', LastName = 'Open');
        Contact bo = new Contact(FirstName = 'Bo', LastName = 'Closed');
        Contact cy = new Contact(FirstName = 'Cy', LastName = 'None');
        insert new List<Contact>{ ana, bo, cy };
        insert new List<Case>{
            new Case(Subject = 'One', ContactId = ana.Id, Status = 'New'),
            new Case(Subject = 'Two', ContactId = ana.Id, Status = 'Working'),
            new Case(Subject = 'Old', ContactId = bo.Id, Status = 'Closed')
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
