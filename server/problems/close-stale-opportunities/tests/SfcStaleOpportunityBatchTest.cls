@isTest
private class SfcStaleOpportunityBatchTest {
    @isTest
    static void closesOnlyStaleOpenOpportunities() {
        List<Opportunity> opps = new List<Opportunity>();
        for (Integer i = 0; i < 150; i++) {
            opps.add(new Opportunity(Name = 'Stale ' + i, StageName = 'Prospecting', CloseDate = Date.today().addDays(-3)));
        }
        Opportunity future = new Opportunity(Name = 'Future', StageName = 'Prospecting', CloseDate = Date.today().addDays(5));
        Opportunity today = new Opportunity(Name = 'Today', StageName = 'Prospecting', CloseDate = Date.today());
        Opportunity won = new Opportunity(Name = 'Won', StageName = 'Closed Won', CloseDate = Date.today().addDays(-10));
        opps.addAll(new List<Opportunity>{ future, today, won });
        insert opps;

        Test.startTest();
        Database.executeBatch(new SfcStaleOpportunityBatch(), 200);
        Test.stopTest();

        System.assertEquals(150, [SELECT COUNT() FROM Opportunity WHERE StageName = 'Closed Lost'],
            'All 150 stale open opportunities should be Closed Lost');
        System.assertEquals('Prospecting', [SELECT StageName FROM Opportunity WHERE Id = :future.Id].StageName, 'Future-dated must stay open');
        System.assertEquals('Prospecting', [SELECT StageName FROM Opportunity WHERE Id = :today.Id].StageName, 'Dated today is not stale');
        System.assertEquals('Closed Won', [SELECT StageName FROM Opportunity WHERE Id = :won.Id].StageName, 'Closed deals are untouched');
    }
}
