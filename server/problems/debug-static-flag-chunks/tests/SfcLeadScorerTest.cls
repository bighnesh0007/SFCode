@isTest
private class SfcLeadScorerTest {
    static List<Lead> leads(Integer n, Decimal revenue) {
        List<Lead> out = new List<Lead>();
        for (Integer i = 0; i < n; i++) out.add(new Lead(LastName = 'L' + i, Company = 'Co ' + i, AnnualRevenue = revenue));
        return out;
    }

    @isTest
    static void scoresASmallInsert() {
        List<Lead> ls = leads(3, 2000000);
        insert ls;
        System.assertEquals(3, [SELECT COUNT() FROM Lead WHERE Rating = 'Hot'], 'Leads over 1,000,000 are Hot');
    }

    @isTest
    static void scoresEveryLeadInA400RecordImport() {
        List<Lead> ls = leads(400, 50000);
        Test.startTest();
        insert ls;
        Test.stopTest();
        System.assertEquals(400, [SELECT COUNT() FROM Lead WHERE Rating = 'Warm'], 'All 400 leads must be rated. Triggers run in chunks of 200 in the same transaction: does a static flag skip the second chunk?');
    }

    @isTest
    static void scoresLaterSavesInTheSameTransaction() {
        insert leads(2, 10);
        List<Lead> more = leads(2, 5000000);
        insert more;
        System.assertEquals(2, [SELECT COUNT() FROM Lead WHERE Rating = 'Hot'], 'A second insert in the same transaction must be scored too');
    }

    @isTest
    static void doesNotScoreTheSameLeadTwice() {
        Lead l = leads(1, 10)[0];
        insert l;
        Integer afterInsert = SfcLeadScorer.scoredCount;
        SfcLeadScorer.score(new List<Lead>{ new Lead(Id = l.Id, AnnualRevenue = 10) });
        SfcLeadScorer.score(new List<Lead>{ new Lead(Id = l.Id, AnnualRevenue = 10) });
        System.assertEquals(afterInsert + 1, SfcLeadScorer.scoredCount, 'The same lead is scored at most once per transaction');
    }

    @isTest
    static void updatesAreScored() {
        Lead l = leads(1, 10)[0];
        insert l;
        l.AnnualRevenue = 9000000;
        update l;
        System.assertEquals('Hot', [SELECT Rating FROM Lead WHERE Id = :l.Id].Rating, 'An update in a later transaction re-scores the lead');
    }
}
