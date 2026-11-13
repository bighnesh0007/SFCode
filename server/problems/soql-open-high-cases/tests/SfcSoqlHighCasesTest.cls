@isTest
private class SfcSoqlHighCasesTest {
    @isTest
    static void matchesReference() {
        insert new List<Case>{
            new Case(Subject = 'Billing broken', Priority = 'High', Status = 'New'),
            new Case(Subject = 'Answered', Priority = 'High', Status = 'Closed'),
            new Case(Subject = 'API errors', Priority = 'High', Status = 'Working'),
            new Case(Subject = 'Feature idea', Priority = 'Low', Status = 'New')
        };
        Test.startTest();
        List<SObject> actual = sfcRunSubmission();
        Test.stopTest();
        List<SObject> expected = Database.query({{REFERENCE_QUERY}});
        System.assert(!expected.isEmpty(), 'Fixture sanity: the reference query must return rows');
        sfcAssertSameRows(expected, actual, true);
    }

{{SOQL_COMPARE}}
}
