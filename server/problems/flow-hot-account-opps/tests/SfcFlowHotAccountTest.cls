@isTest
private class SfcFlowHotAccountTest {
    static Map<String, Opportunity> byName(Id accountId) {
        Map<String, Opportunity> out = new Map<String, Opportunity>();
        for (Opportunity o : [SELECT Name, NextStep FROM Opportunity WHERE AccountId = :accountId]) out.put(o.Name, o);
        return out;
    }

    static Account withDeals(String name) {
        Account a = new Account(Name = name, Rating = 'Warm');
        insert a;
        Date d = Date.today().addDays(30);
        insert new List<Opportunity>{
            new Opportunity(Name = name + ' open', AccountId = a.Id, StageName = 'Prospecting', CloseDate = d),
            new Opportunity(Name = name + ' open 2', AccountId = a.Id, StageName = 'Qualification', CloseDate = d),
            new Opportunity(Name = name + ' won', AccountId = a.Id, StageName = 'Closed Won', CloseDate = d),
            new Opportunity(Name = name + ' lost', AccountId = a.Id, StageName = 'Closed Lost', CloseDate = d)
        };
        return a;
    }

    @isTest
    static void flagsOpenDealsWhenAccountTurnsHot() {
        Account a = withDeals('Acme');
        a.Rating = 'Hot';
        update a;
        Map<String, Opportunity> opps = byName(a.Id);
        System.assertEquals('Call this week', opps.get('Acme open').NextStep, 'Is SFC_Hot_Account_Opps active? Open deals should get NextStep = Call this week');
        System.assertEquals('Call this week', opps.get('Acme open 2').NextStep, 'Every open deal is flagged, not just one');
        System.assertEquals(null, opps.get('Acme won').NextStep, 'Closed Won deals are left alone');
        System.assertEquals(null, opps.get('Acme lost').NextStep, 'Closed Lost deals are left alone');
    }

    @isTest
    static void leavesOtherAccountsAlone() {
        Account a = withDeals('Acme');
        Account other = withDeals('Other');
        a.Rating = 'Hot';
        update a;
        System.assertEquals(null, byName(other.Id).get('Other open').NextStep, 'Only the account that turned Hot is affected');
    }

    @isTest
    static void runsOnlyWhenRatingChangesToHot() {
        Account a = withDeals('Acme');
        a.Rating = 'Hot';
        update a;
        Opportunity o = byName(a.Id).get('Acme open');
        o.NextStep = 'Sent proposal';
        update o;
        a.Description = 'Still hot';
        update a;
        System.assertEquals('Sent proposal', byName(a.Id).get('Acme open').NextStep, 'Saving an account that is already Hot must not run the flow again');
    }

    @isTest
    static void bulkUpdate() {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < 50; i++) accounts.add(new Account(Name = 'Bulk ' + i, Rating = 'Cold'));
        insert accounts;
        List<Opportunity> opps = new List<Opportunity>();
        for (Account a : accounts) opps.add(new Opportunity(Name = a.Name, AccountId = a.Id, StageName = 'Prospecting', CloseDate = Date.today().addDays(10)));
        insert opps;
        for (Account a : accounts) a.Rating = 'Hot';
        update accounts;
        System.assertEquals(50, [SELECT COUNT() FROM Opportunity WHERE NextStep = 'Call this week'], 'Works for 50 accounts updated at once');
    }
}
