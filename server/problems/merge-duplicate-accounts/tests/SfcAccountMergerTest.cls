@isTest
private class SfcAccountMergerTest {
    @isTest
    static void mergesIntoTheOldestAndMovesChildren() {
        Account oldest = new Account(Name = 'Acme');
        insert oldest;
        Account dupe1 = new Account(Name = ' ACME ');
        Account dupe2 = new Account(Name = 'acme');
        insert new List<Account>{ dupe1, dupe2 };
        Test.setCreatedDate(oldest.Id, Datetime.now().addDays(-10));
        insert new Contact(LastName = 'Moved', AccountId = dupe2.Id);
        Integer merged = SfcAccountMerger.mergeDuplicates(new List<Account>{ dupe1, oldest, dupe2 });
        System.assertEquals(2, merged, 'Two duplicates merged away');
        System.assertEquals(1, [SELECT COUNT() FROM Account], 'Only the survivor is left');
        System.assertEquals(oldest.Id, [SELECT Id FROM Account].Id, 'The oldest account survives');
        System.assertEquals(oldest.Id, [SELECT AccountId FROM Contact WHERE LastName = 'Moved'].AccountId, 'Merging moves contacts to the survivor');
    }

    @isTest
    static void groupsOfFiveNeedTwoMerges() {
        List<Account> five = new List<Account>();
        for (Integer i = 0; i < 5; i++) five.add(new Account(Name = 'Globex'));
        insert five;
        System.assertEquals(4, SfcAccountMerger.mergeDuplicates(five), 'A group of five merges four accounts (merge takes at most two duplicates per call)');
        System.assertEquals(1, [SELECT COUNT() FROM Account WHERE Name = 'Globex']);
    }

    @isTest
    static void leavesUniqueAccountsAlone() {
        List<Account> accts = new List<Account>{ new Account(Name = 'Initech'), new Account(Name = 'Umbrella'), new Account(Name = 'Initech') };
        insert accts;
        System.assertEquals(1, SfcAccountMerger.mergeDuplicates(accts));
        System.assertEquals(1, [SELECT COUNT() FROM Account WHERE Name = 'Umbrella'], 'Accounts without duplicates are untouched');
    }

    @isTest
    static void tieOnCreatedDateKeepsTheSmallestId() {
        List<Account> pair = new List<Account>{ new Account(Name = 'Tie'), new Account(Name = 'Tie') };
        insert pair;
        Datetime same = Datetime.now().addDays(-1);
        Test.setCreatedDate(pair[0].Id, same);
        Test.setCreatedDate(pair[1].Id, same);
        Id smaller = String.valueOf(pair[0].Id) < String.valueOf(pair[1].Id) ? pair[0].Id : pair[1].Id;
        SfcAccountMerger.mergeDuplicates(pair);
        System.assertEquals(smaller, [SELECT Id FROM Account WHERE Name = 'Tie'].Id, 'On equal CreatedDate the smallest Id survives');
    }

    @isTest
    static void worksWithOnlyIdsGiven() {
        List<Account> accts = new List<Account>{ new Account(Name = 'Hooli'), new Account(Name = 'hooli') };
        insert accts;
        List<Account> idsOnly = new List<Account>{ new Account(Id = accts[0].Id), new Account(Id = accts[1].Id) };
        System.assertEquals(1, SfcAccountMerger.mergeDuplicates(idsOnly), 'Query the names yourself; the input may only carry Ids');
    }

    @isTest
    static void emptyInput() {
        System.assertEquals(0, SfcAccountMerger.mergeDuplicates(new List<Account>()));
        System.assertEquals(0, SfcAccountMerger.mergeDuplicates(null));
    }
}
