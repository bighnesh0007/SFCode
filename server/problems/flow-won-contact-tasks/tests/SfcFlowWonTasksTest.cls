@isTest
private class SfcFlowWonTasksTest {
    static Integer thankYous(Id oppId) {
        return [SELECT COUNT() FROM Task WHERE WhatId = :oppId AND Subject = 'Send thank-you note'];
    }

    static Opportunity dealWithContacts(String name, Integer contactCount) {
        Account a = new Account(Name = name);
        insert a;
        Opportunity o = new Opportunity(Name = name, AccountId = a.Id, StageName = 'Negotiation/Review', CloseDate = Date.today());
        insert o;
        List<Contact> contacts = new List<Contact>();
        for (Integer i = 0; i < contactCount; i++) contacts.add(new Contact(LastName = name + ' ' + i, AccountId = a.Id));
        insert contacts;
        List<OpportunityContactRole> roles = new List<OpportunityContactRole>();
        for (Contact c : contacts) roles.add(new OpportunityContactRole(OpportunityId = o.Id, ContactId = c.Id, Role = 'Decision Maker'));
        insert roles;
        return o;
    }

    @isTest
    static void oneTaskPerContactRole() {
        Opportunity o = dealWithContacts('Acme', 3);
        o.StageName = 'Closed Won';
        update o;
        System.assertEquals(3, thankYous(o.Id), 'Is SFC_Won_Contact_Tasks active? Expected one thank-you task per contact role');
        Set<Id> who = new Set<Id>();
        for (Task t : [SELECT WhoId, OwnerId FROM Task WHERE WhatId = :o.Id]) {
            who.add(t.WhoId);
            System.assertEquals([SELECT OwnerId FROM Opportunity WHERE Id = :o.Id].OwnerId, t.OwnerId, 'Tasks belong to the opportunity owner');
        }
        System.assertEquals(3, who.size(), 'Each task is for a different contact (WhoId)');
    }

    @isTest
    static void noRolesNoTasks() {
        Opportunity o = dealWithContacts('Solo', 0);
        o.StageName = 'Closed Won';
        update o;
        System.assertEquals(0, thankYous(o.Id), 'A deal without contact roles gets no tasks');
    }

    @isTest
    static void onlyWhenStageChangesToWon() {
        Opportunity o = dealWithContacts('Acme', 2);
        o.StageName = 'Closed Won';
        update o;
        o.Description = 'Signed';
        update o;
        System.assertEquals(2, thankYous(o.Id), 'Saving an already-won deal must not create the tasks again');
    }

    @isTest
    static void dealWithManyContacts() {
        Opportunity o = dealWithContacts('Big', 160);
        o.StageName = 'Closed Won';
        Test.startTest();
        update o;
        Test.stopTest();
        System.assertEquals(160, thankYous(o.Id), 'A deal with 160 contact roles must get 160 tasks. Create Records inside the loop runs one DML per contact and passes the 150-statement limit');
    }

    @isTest
    static void bulkWins() {
        Account a = new Account(Name = 'Bulk');
        insert a;
        List<Contact> contacts = new List<Contact>();
        for (Integer i = 0; i < 4; i++) contacts.add(new Contact(LastName = 'C' + i, AccountId = a.Id));
        insert contacts;
        List<Opportunity> opps = new List<Opportunity>();
        for (Integer i = 0; i < 160; i++) opps.add(new Opportunity(Name = 'Deal ' + i, AccountId = a.Id, StageName = 'Prospecting', CloseDate = Date.today()));
        insert opps;
        List<OpportunityContactRole> roles = new List<OpportunityContactRole>();
        for (Opportunity o : opps) for (Contact c : contacts) roles.add(new OpportunityContactRole(OpportunityId = o.Id, ContactId = c.Id));
        insert roles;
        for (Opportunity o : opps) o.StageName = 'Closed Won';
        Test.startTest();
        update opps;
        Test.stopTest();
        System.assertEquals(640, [SELECT COUNT() FROM Task WHERE Subject = 'Send thank-you note'], 'Winning 160 deals with 4 contacts each must create 640 tasks without hitting limits');
    }
}
