@isTest
private class SfcFlowRepeatCallerTest {
    static Contact person(String name) {
        Contact c = new Contact(LastName = name);
        insert c;
        return c;
    }

    static String priorityOf(Id caseId) {
        return [SELECT Priority FROM Case WHERE Id = :caseId].Priority;
    }

    @isTest
    static void secondOpenCaseIsHigh() {
        Contact c = person('Ada');
        insert new Case(Subject = 'First', ContactId = c.Id, Priority = 'Medium', Status = 'New');
        Case second = new Case(Subject = 'Second', ContactId = c.Id, Priority = 'Medium', Status = 'New');
        insert second;
        System.assertEquals('High', priorityOf(second.Id), 'Is SFC_Repeat_Caller_Priority active? A contact with another open case is a repeat caller');
    }

    @isTest
    static void firstCaseKeepsItsPriority() {
        Contact c = person('Ada');
        Case first = new Case(Subject = 'First', ContactId = c.Id, Priority = 'Low', Status = 'New');
        insert first;
        System.assertEquals('Low', priorityOf(first.Id), 'A first case must not find itself and become High');
    }

    @isTest
    static void closedEarlierCasesDontCount() {
        Contact c = person('Ada');
        insert new Case(Subject = 'Old', ContactId = c.Id, Priority = 'Medium', Status = 'Closed');
        Case next = new Case(Subject = 'New', ContactId = c.Id, Priority = 'Medium', Status = 'New');
        insert next;
        System.assertEquals('Medium', priorityOf(next.Id), 'Only open earlier cases make a repeat caller');
    }

    @isTest
    static void casesWithoutContactAreLeftAlone() {
        insert new Case(Subject = 'Anon 1', Priority = 'Low', Status = 'New');
        Case anon = new Case(Subject = 'Anon 2', Priority = 'Low', Status = 'New');
        insert anon;
        System.assertEquals('Low', priorityOf(anon.Id), 'Cases without a contact are left alone');
    }

    @isTest
    static void otherContactsDontCount() {
        insert new Case(Subject = 'Ada open', ContactId = person('Ada').Id, Priority = 'Medium', Status = 'New');
        Case grace = new Case(Subject = 'Grace', ContactId = person('Grace').Id, Priority = 'Medium', Status = 'New');
        insert grace;
        System.assertEquals('Medium', priorityOf(grace.Id));
    }

    @isTest
    static void bulkCases() {
        List<Contact> people = new List<Contact>();
        for (Integer i = 0; i < 100; i++) people.add(new Contact(LastName = 'P' + i));
        insert people;
        List<Case> first = new List<Case>();
        for (Contact p : people) first.add(new Case(Subject = 'First', ContactId = p.Id, Priority = 'Medium', Status = 'New'));
        insert first;
        List<Case> second = new List<Case>();
        for (Contact p : people) second.add(new Case(Subject = 'Second', ContactId = p.Id, Priority = 'Medium', Status = 'New'));
        insert second;
        System.assertEquals(100, [SELECT COUNT() FROM Case WHERE Subject = 'Second' AND Priority = 'High'], 'All 100 repeat callers are escalated in one insert');
        System.assertEquals(0, [SELECT COUNT() FROM Case WHERE Subject = 'First' AND Priority = 'High'], 'First cases stay as they were');
    }
}
