@isTest
private class SfcSoqlPipelineTest {
    @isTest
    static void matchesReference() {
        Date d = Date.today();
        insert new List<Opportunity>{
            new Opportunity(Name = 'A', StageName = 'Prospecting', Amount = 100, CloseDate = d),
            new Opportunity(Name = 'B', StageName = 'Prospecting', Amount = 50, CloseDate = d),
            new Opportunity(Name = 'C', StageName = 'Closed Won', Amount = 400, CloseDate = d),
            new Opportunity(Name = 'D', StageName = 'Closed Lost', CloseDate = d)
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
