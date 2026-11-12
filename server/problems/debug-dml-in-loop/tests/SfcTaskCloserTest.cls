@isTest
private class SfcTaskCloserTest {
    @isTest
    static void closesTwoHundredTasks() {
        List<Task> tasks = new List<Task>();
        for (Integer i = 0; i < 200; i++) {
            tasks.add(new Task(Subject = 'Follow up ' + i, Status = 'Not Started'));
        }
        insert tasks;
        Test.startTest();
        SfcTaskCloser.closeAll(tasks);
        Test.stopTest();
        System.assertEquals(200, [SELECT COUNT() FROM Task WHERE Status = 'Completed'], 'All 200 tasks should be Completed');
    }

    @isTest
    static void emptyAndNullUseNoDml() {
        Test.startTest();
        SfcTaskCloser.closeAll(null);
        SfcTaskCloser.closeAll(new List<Task>());
        System.assertEquals(0, Limits.getDmlStatements(), 'An empty or null list must not run any DML');
        Test.stopTest();
    }
}
