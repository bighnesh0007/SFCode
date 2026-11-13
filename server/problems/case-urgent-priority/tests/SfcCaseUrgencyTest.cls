@isTest
private class SfcCaseUrgencyTest {
    static String priorityOf(Case c) {
        return [SELECT Priority FROM Case WHERE Id = :c.Id].Priority;
    }

    @isTest
    static void flagsUrgentInAnyCase() {
        Case a = new Case(Subject = 'URGENT: site down', Priority = 'Low');
        Case b = new Case(Subject = 'This is urgent please', Priority = 'Medium');
        insert new List<Case>{ a, b };
        System.assertEquals('High', priorityOf(a), 'Upper-case URGENT should set High');
        System.assertEquals('High', priorityOf(b), 'Lower-case urgent should set High');
    }

    @isTest
    static void leavesOthersAlone() {
        Case c = new Case(Subject = 'Question about invoices', Priority = 'Low');
        Case blank = new Case(Priority = 'Medium');
        insert new List<Case>{ c, blank };
        System.assertEquals('Low', priorityOf(c), 'A subject without "urgent" keeps its Priority');
        System.assertEquals('Medium', priorityOf(blank), 'A blank subject keeps its Priority and must not fail');
    }

    @isTest
    static void handles200() {
        List<Case> cases = new List<Case>();
        for (Integer i = 0; i < 200; i++) {
            cases.add(new Case(Subject = Math.mod(i, 2) == 0 ? 'Urgent ' + i : 'Routine ' + i, Priority = 'Low'));
        }
        Test.startTest();
        insert cases;
        Test.stopTest();
        System.assertEquals(100, [SELECT COUNT() FROM Case WHERE Priority = 'High'], 'Exactly the 100 urgent cases should be High');
    }
}
