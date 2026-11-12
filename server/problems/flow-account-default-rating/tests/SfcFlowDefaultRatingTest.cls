@isTest
private class SfcFlowDefaultRatingTest {
    @isTest
    static void setsHotForBlankTechnology() {
        Account a = new Account(Name = 'Acme', Industry = 'Technology');
        insert a;
        System.assertEquals('Hot', [SELECT Rating FROM Account WHERE Id = :a.Id].Rating,
            'Is SFC_Account_Default_Rating active? A Technology account with no Rating should become Hot');
    }

    @isTest
    static void keepsExistingRating() {
        Account a = new Account(Name = 'Acme', Industry = 'Technology', Rating = 'Cold');
        insert a;
        System.assertEquals('Cold', [SELECT Rating FROM Account WHERE Id = :a.Id].Rating, 'An existing Rating must not be overwritten');
    }

    @isTest
    static void ignoresOtherIndustries() {
        Account a = new Account(Name = 'Bank', Industry = 'Banking');
        insert a;
        System.assertEquals(null, [SELECT Rating FROM Account WHERE Id = :a.Id].Rating, 'Non-Technology accounts must be left alone');
    }

    @isTest
    static void handles200Records() {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < 200; i++) {
            accounts.add(new Account(Name = 'Bulk ' + i, Industry = Math.mod(i, 2) == 0 ? 'Technology' : 'Banking'));
        }
        insert accounts;
        System.assertEquals(100, [SELECT COUNT() FROM Account WHERE Rating = 'Hot'], 'Exactly the 100 Technology accounts should be Hot');
    }
}
