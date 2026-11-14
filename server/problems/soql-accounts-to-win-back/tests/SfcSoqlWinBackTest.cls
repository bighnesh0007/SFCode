@isTest
private class SfcSoqlWinBackTest {
    @isTest
    static void matchesReference() {
        Account oldWin = new Account(Name = 'Bravo old win');
        Account recentWin = new Account(Name = 'Alpha recent win');
        Account neverWon = new Account(Name = 'Charlie never won');
        Account noOpen = new Account(Name = 'Delta nothing open');
        Account nothing = new Account(Name = 'Echo empty');
        insert new List<Account>{ oldWin, recentWin, neverWon, noOpen, nothing };
        Date today = Date.today();
        insert new List<Opportunity>{
            new Opportunity(Name = 'b1', AccountId = oldWin.Id, StageName = 'Prospecting', CloseDate = today.addDays(30)),
            new Opportunity(Name = 'b2', AccountId = oldWin.Id, StageName = 'Closed Won', CloseDate = today.addDays(-500)),
            new Opportunity(Name = 'a1', AccountId = recentWin.Id, StageName = 'Prospecting', CloseDate = today.addDays(30)),
            new Opportunity(Name = 'a2', AccountId = recentWin.Id, StageName = 'Closed Won', CloseDate = today.addDays(-20)),
            new Opportunity(Name = 'c1', AccountId = neverWon.Id, StageName = 'Qualification', CloseDate = today.addDays(10)),
            new Opportunity(Name = 'c2', AccountId = neverWon.Id, StageName = 'Closed Lost', CloseDate = today.addDays(-5)),
            new Opportunity(Name = 'd1', AccountId = noOpen.Id, StageName = 'Closed Lost', CloseDate = today.addDays(-5))
        };
        Test.startTest();
        List<SObject> actual = sfcRunSubmission();
        Test.stopTest();
        List<SObject> expected = Database.query({{REFERENCE_QUERY}});
        System.assertEquals(2, expected.size(), 'Fixture sanity: Bravo and Charlie qualify');
        sfcAssertSameRows(expected, actual, true);
    }

{{SOQL_COMPARE}}
}
