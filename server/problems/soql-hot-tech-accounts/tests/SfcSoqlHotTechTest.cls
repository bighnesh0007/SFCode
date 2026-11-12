@isTest
private class SfcSoqlHotTechTest {
    @isTest
    static void matchesReference() {
        insert new List<Account>{
            new Account(Name = 'Beta', Industry = 'Technology', Rating = 'Hot', AnnualRevenue = 500),
            new Account(Name = 'Alpha', Industry = 'Technology', Rating = 'Hot', AnnualRevenue = 500),
            new Account(Name = 'Gamma', Industry = 'Technology', Rating = 'Hot'),
            new Account(Name = 'Delta', Industry = 'Technology', Rating = 'Hot', AnnualRevenue = 900),
            new Account(Name = 'Cold Tech', Industry = 'Technology', Rating = 'Cold', AnnualRevenue = 1000),
            new Account(Name = 'Hot Bank', Industry = 'Banking', Rating = 'Hot', AnnualRevenue = 2000)
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
