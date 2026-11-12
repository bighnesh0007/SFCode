@isTest
private class SfcProtectClosedWonTest {
    static Opportunity opp(String stage) {
        return new Opportunity(Name = stage, StageName = stage, CloseDate = Date.today());
    }

    @isTest
    static void blocksClosedWon() {
        Opportunity won = opp('Closed Won');
        insert won;
        Database.DeleteResult r = Database.delete(won, false);
        System.assert(!r.isSuccess(), 'Deleting a Closed Won opportunity should fail');
        System.assertEquals('Closed Won opportunities cannot be deleted.', r.getErrors()[0].getMessage(),
            'Use the exact error message from the statement');
    }

    @isTest
    static void allowsOtherStages() {
        Opportunity open = opp('Prospecting');
        insert open;
        delete open;
        System.assertEquals(0, [SELECT COUNT() FROM Opportunity WHERE Id = :open.Id],
            'Non-won opportunities must delete normally');
    }

    @isTest
    static void onlyWonFailsInMixedBatch() {
        List<Opportunity> opps = new List<Opportunity>{ opp('Closed Won'), opp('Prospecting') };
        insert opps;
        List<Database.DeleteResult> results = Database.delete(opps, false);
        System.assert(!results[0].isSuccess(), 'The Closed Won record should be blocked');
        System.assert(results[1].isSuccess(), 'The Prospecting record should still delete');
    }
}
