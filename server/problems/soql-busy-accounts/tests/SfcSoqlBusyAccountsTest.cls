@isTest
private class SfcSoqlBusyAccountsTest {
    @isTest
    static void matchesReference() {
        Account busy = new Account(Name = 'Busy');
        Account mostlyClosed = new Account(Name = 'Mostly Closed');
        Account two = new Account(Name = 'Exactly Two');
        insert new List<Account>{ busy, mostlyClosed, two };
        Date d = Date.today();
        insert new List<Opportunity>{
            new Opportunity(Name = 'B1', AccountId = busy.Id, StageName = 'Prospecting', CloseDate = d),
            new Opportunity(Name = 'B2', AccountId = busy.Id, StageName = 'Qualification', CloseDate = d),
            new Opportunity(Name = 'B3', AccountId = busy.Id, StageName = 'Prospecting', CloseDate = d),
            new Opportunity(Name = 'M1', AccountId = mostlyClosed.Id, StageName = 'Prospecting', CloseDate = d),
            new Opportunity(Name = 'M2', AccountId = mostlyClosed.Id, StageName = 'Closed Won', CloseDate = d),
            new Opportunity(Name = 'M3', AccountId = mostlyClosed.Id, StageName = 'Closed Lost', CloseDate = d),
            new Opportunity(Name = 'T1', AccountId = two.Id, StageName = 'Prospecting', CloseDate = d),
            new Opportunity(Name = 'T2', AccountId = two.Id, StageName = 'Prospecting', CloseDate = d),
            new Opportunity(Name = 'T3', AccountId = two.Id, StageName = 'Closed Lost', CloseDate = d)
        };
        Test.startTest();
        List<SObject> actual = sfcRunSubmission();
        Test.stopTest();
        List<SObject> expected = Database.query({{REFERENCE_QUERY}});
        System.assertEquals(2, expected.size(), 'Fixture sanity: Busy and Exactly Two qualify');
        sfcAssertSameRows(expected, actual, false);
    }

{{SOQL_COMPARE}}
}
