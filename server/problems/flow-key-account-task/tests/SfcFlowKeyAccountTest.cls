@isTest
private class SfcFlowKeyAccountTest {
    static Integer reviewTasks(Id accountId) {
        return [SELECT COUNT() FROM Task WHERE WhatId = :accountId AND Subject = 'Review key account'];
    }

    @isTest
    static void createsTaskWhenAccountBecomesKey() {
        Account a = new Account(Name = 'Growing', AnnualRevenue = 500000);
        insert a;
        System.assertEquals(0, reviewTasks(a.Id), 'Below the threshold: no task yet');
        a.AnnualRevenue = 2000000;
        update a;
        System.assertEquals(1, reviewTasks(a.Id), 'Is SFC_Key_Account_Review active? Crossing 1,000,000 should create one review task');
        Task t = [SELECT OwnerId FROM Task WHERE WhatId = :a.Id LIMIT 1];
        System.assertEquals([SELECT OwnerId FROM Account WHERE Id = :a.Id].OwnerId, t.OwnerId, 'The task belongs to the account owner');
    }

    @isTest
    static void doesNotRepeatForAlreadyKeyAccounts() {
        Account a = new Account(Name = 'Growing', AnnualRevenue = 500000);
        insert a;
        a.AnnualRevenue = 2000000;
        update a;
        a.AnnualRevenue = 3000000;
        update a;
        System.assertEquals(1, reviewTasks(a.Id), 'Only changing to meet the condition creates a task, not every update');
    }

    @isTest
    static void ignoresSmallAccounts() {
        Account a = new Account(Name = 'Small', AnnualRevenue = 100);
        insert a;
        a.AnnualRevenue = 900000;
        update a;
        System.assertEquals(0, reviewTasks(a.Id), 'Accounts at or below 1,000,000 get no task');
    }
}
