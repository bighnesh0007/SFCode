@isTest
private class SfcSoqlMonthlyRevenueTest {
    @isTest
    static void matchesReference() {
        Integer y = Date.today().year();
        insert new List<Opportunity>{
            new Opportunity(Name = 'Feb 1', StageName = 'Closed Won', Amount = 100, CloseDate = Date.newInstance(y, 2, 3)),
            new Opportunity(Name = 'Feb 2', StageName = 'Closed Won', Amount = 250, CloseDate = Date.newInstance(y, 2, 20)),
            new Opportunity(Name = 'Jun', StageName = 'Closed Won', Amount = 70, CloseDate = Date.newInstance(y, 6, 1)),
            new Opportunity(Name = 'Jun lost', StageName = 'Closed Lost', Amount = 999, CloseDate = Date.newInstance(y, 6, 2)),
            new Opportunity(Name = 'Jun open', StageName = 'Prospecting', Amount = 500, CloseDate = Date.newInstance(y, 6, 9)),
            new Opportunity(Name = 'Last year', StageName = 'Closed Won', Amount = 5000, CloseDate = Date.newInstance(y - 1, 2, 3))
        };
        Test.startTest();
        List<SObject> actual = sfcRunSubmission();
        Test.stopTest();
        List<SObject> expected = Database.query({{REFERENCE_QUERY}});
        System.assertEquals(2, expected.size(), 'Fixture sanity: February and June');
        sfcAssertSameRows(expected, actual, true);
    }

{{SOQL_COMPARE}}
}
