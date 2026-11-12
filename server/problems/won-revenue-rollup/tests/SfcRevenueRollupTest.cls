@isTest
private class SfcRevenueRollupTest {
    static Opportunity opp(Id accountId, String stage, Decimal amount) {
        return new Opportunity(Name = 'O', AccountId = accountId, StageName = stage, Amount = amount, CloseDate = Date.today());
    }

    static Decimal revenue(Id accountId) {
        return [SELECT AnnualRevenue FROM Account WHERE Id = :accountId].AnnualRevenue;
    }

    @isTest
    static void sumsOnlyWonOnInsert() {
        Account a = new Account(Name = 'A');
        insert a;
        insert new List<Opportunity>{ opp(a.Id, 'Closed Won', 100), opp(a.Id, 'Closed Won', 200), opp(a.Id, 'Prospecting', 50) };
        System.assertEquals(300, revenue(a.Id), 'Only Closed Won amounts count');
    }

    @isTest
    static void followsStageAndAmountChanges() {
        Account a = new Account(Name = 'A');
        insert a;
        Opportunity o = opp(a.Id, 'Prospecting', 80);
        insert o;
        o.StageName = 'Closed Won';
        update o;
        System.assertEquals(80, revenue(a.Id), 'Winning an opportunity adds its amount');
        o.Amount = 120;
        update o;
        System.assertEquals(120, revenue(a.Id), 'Changing the amount updates the total');
    }

    @isTest
    static void handlesDeleteAndUndelete() {
        Account a = new Account(Name = 'A');
        insert a;
        Opportunity o = opp(a.Id, 'Closed Won', 70);
        insert o;
        delete o;
        System.assertEquals(0, revenue(a.Id), 'No won opportunities means 0, not null');
        undelete o;
        System.assertEquals(70, revenue(a.Id), 'Undelete restores the amount');
    }

    @isTest
    static void reparentingUpdatesBothAccounts() {
        Account a = new Account(Name = 'A');
        Account b = new Account(Name = 'B');
        insert new List<Account>{ a, b };
        Opportunity o = opp(a.Id, 'Closed Won', 90);
        insert o;
        o.AccountId = b.Id;
        update o;
        System.assertEquals(0, revenue(a.Id), 'The old account loses the amount');
        System.assertEquals(90, revenue(b.Id), 'The new account gains it');
    }

    @isTest
    static void handles200Opportunities() {
        Account a = new Account(Name = 'A');
        Account b = new Account(Name = 'B');
        insert new List<Account>{ a, b };
        List<Opportunity> opps = new List<Opportunity>();
        for (Integer i = 0; i < 200; i++) {
            opps.add(opp(Math.mod(i, 2) == 0 ? a.Id : b.Id, 'Closed Won', 1));
        }
        Test.startTest();
        insert opps;
        Test.stopTest();
        System.assertEquals(100, revenue(a.Id));
        System.assertEquals(100, revenue(b.Id));
    }
}
