@isTest
private class SfcAccountSearchTest {
    @testSetup
    static void data() {
        insert new List<Account>{
            new Account(Name = 'Beta', Industry = 'Technology'),
            new Account(Name = 'Alpha', Industry = 'Technology'),
            new Account(Name = 'Bank', Industry = 'Banking')
        };
    }

    @isTest
    static void findsByIndustrySorted() {
        System.assertEquals(new List<String>{ 'Alpha', 'Beta' }, SfcAccountSearch.byIndustry('Technology'));
    }

    @isTest
    static void injectionReturnsNothing() {
        System.assertEquals(0, SfcAccountSearch.byIndustry('x\' OR Name != \'').size(), 'Quotes in the input must not change the query');
        System.assertEquals(0, SfcAccountSearch.byIndustry('Technology\' OR Industry = \'Banking').size(), 'Quotes in the input must not change the query');
    }

    @isTest
    static void blankReturnsEmpty() {
        System.assertEquals(0, SfcAccountSearch.byIndustry(null).size());
        System.assertEquals(0, SfcAccountSearch.byIndustry('  ').size());
    }
}
