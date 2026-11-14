@isTest
private class SfcFlowLockAmountTest {
    static Opportunity deal(String stage, Decimal amount) {
        Opportunity o = new Opportunity(Name = 'Deal', StageName = stage, Amount = amount, CloseDate = Date.today());
        insert o;
        return o;
    }

    @isTest
    static void blocksAmountChangeOnClosedDeal() {
        Opportunity o = deal('Closed Won', 1000);
        o.Amount = 5000;
        try {
            update o;
            System.assert(false, 'Is SFC_Lock_Closed_Amount active? Changing the amount of a closed deal should be blocked');
        } catch (DmlException e) {
            System.assert(e.getMessage().contains('Closed deals can\'t change amount.'), 'Use the exact message. Got: ' + e.getMessage());
        }
        System.assertEquals(1000, [SELECT Amount FROM Opportunity WHERE Id = :o.Id].Amount, 'The amount stays as it was');
    }

    @isTest
    static void blocksOnClosedLostToo() {
        Opportunity o = deal('Closed Lost', 1000);
        o.Amount = 1;
        Database.SaveResult r = Database.update(o, false);
        System.assert(!r.isSuccess(), 'Closed Lost deals are closed too');
    }

    @isTest
    static void allowsClosingAndSettingAmountTogether() {
        Opportunity o = deal('Prospecting', 1000);
        o.StageName = 'Closed Won';
        o.Amount = 2500;
        update o;
        System.assertEquals(2500, [SELECT Amount FROM Opportunity WHERE Id = :o.Id].Amount, 'The save that closes the deal may set its amount');
    }

    @isTest
    static void allowsOtherEditsOnClosedDeals() {
        Opportunity o = deal('Closed Won', 1000);
        o.Description = 'Signed on paper';
        update o;
        System.assertEquals('Signed on paper', [SELECT Description FROM Opportunity WHERE Id = :o.Id].Description, 'Only the amount is locked');
    }

    @isTest
    static void allowsAmountChangesOnOpenDeals() {
        Opportunity o = deal('Prospecting', 1000);
        o.Amount = 3000;
        update o;
        System.assertEquals(3000, [SELECT Amount FROM Opportunity WHERE Id = :o.Id].Amount);
    }
}
