@isTest
private class SfcSoqlWonDealsTest {
    @isTest
    static void matchesReference() {
        Account zeta = new Account(Name = 'Zeta');
        Account acme = new Account(Name = 'Acme');
        Account none = new Account(Name = 'Nothing Won');
        insert new List<Account>{ zeta, acme, none };
        Date d = Date.today();
        insert new List<Opportunity>{
            new Opportunity(Name = 'Z1', AccountId = zeta.Id, StageName = 'Closed Won', Amount = 10, CloseDate = d),
            new Opportunity(Name = 'A1', AccountId = acme.Id, StageName = 'Closed Won', Amount = 20, CloseDate = d),
            new Opportunity(Name = 'A2', AccountId = acme.Id, StageName = 'Closed Won', Amount = 90, CloseDate = d),
            new Opportunity(Name = 'A3', AccountId = acme.Id, StageName = 'Prospecting', Amount = 500, CloseDate = d),
            new Opportunity(Name = 'N1', AccountId = none.Id, StageName = 'Closed Lost', Amount = 70, CloseDate = d)
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
