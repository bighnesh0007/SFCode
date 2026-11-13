@isTest
private class SfcSoqlThisQuarterTest {
    @isTest
    static void matchesReference() {
        Date today = Date.today();
        Date qStart = Date.newInstance(today.year(), ((today.month() - 1) / 3) * 3 + 1, 1);
        insert new List<Opportunity>{
            new Opportunity(Name = 'This quarter', StageName = 'Prospecting', CloseDate = qStart, Amount = 100),
            new Opportunity(Name = 'Also this quarter', StageName = 'Prospecting', CloseDate = qStart.addMonths(3).addDays(-1), Amount = 200),
            new Opportunity(Name = 'Next quarter', StageName = 'Prospecting', CloseDate = qStart.addMonths(3), Amount = 300),
            new Opportunity(Name = 'Last quarter', StageName = 'Prospecting', CloseDate = qStart.addDays(-1), Amount = 400),
            new Opportunity(Name = 'Won this quarter', StageName = 'Closed Won', CloseDate = qStart, Amount = 500)
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
