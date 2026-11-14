@isTest
private class SfcRatingBatchTest {
    @isTest
    static void summaryCountsTheWholeRun() {
        List<Account> accts = new List<Account>();
        for (Integer i = 0; i < 6; i++) accts.add(new Account(Name = 'Big ' + i, AnnualRevenue = 5000000));
        for (Integer i = 0; i < 4; i++) accts.add(new Account(Name = 'Small ' + i, AnnualRevenue = 10));
        insert accts;
        Test.startTest();
        Database.executeBatch(new SfcRatingBatch());
        Test.stopTest();
        System.assertEquals(6, [SELECT COUNT() FROM Account WHERE Rating = 'Hot'], 'Big accounts are rated Hot');
        List<Task> summary = [SELECT Subject FROM Task WHERE Subject LIKE 'Rating batch:%'];
        System.assertEquals(1, summary.size(), 'finish() logs one summary task');
        System.assertEquals('Rating batch: 6 accounts rated Hot', summary[0].Subject, 'finish() runs in its own transaction: without Database.Stateful the counter is back to 0');
    }

    @isTest
    static void zeroWhenNothingQualifies() {
        insert new Account(Name = 'Tiny', AnnualRevenue = 1);
        Test.startTest();
        Database.executeBatch(new SfcRatingBatch());
        Test.stopTest();
        System.assertEquals('Rating batch: 0 accounts rated Hot', [SELECT Subject FROM Task WHERE Subject LIKE 'Rating batch:%'].Subject);
    }
}
