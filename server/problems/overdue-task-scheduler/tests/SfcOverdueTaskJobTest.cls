@isTest
private class SfcOverdueTaskJobTest {
    @isTest
    static void raisesOnlyOverdueOpenTasks() {
        Task late = new Task(Subject = 'Late', ActivityDate = Date.today().addDays(-3), Status = 'Not Started', Priority = 'Normal');
        Task today = new Task(Subject = 'Today', ActivityDate = Date.today(), Status = 'Not Started', Priority = 'Normal');
        Task undated = new Task(Subject = 'Undated', Status = 'Not Started', Priority = 'Normal');
        Task done = new Task(Subject = 'Done', ActivityDate = Date.today().addDays(-3), Status = 'Completed', Priority = 'Normal');
        insert new List<Task>{ late, today, undated, done };

        Test.startTest();
        new SfcOverdueTaskJob().execute(null);
        Test.stopTest();

        Map<Id, Task> after = new Map<Id, Task>([SELECT Priority FROM Task]);
        System.assertEquals('High', after.get(late.Id).Priority, 'An open task due in the past should become High');
        System.assertEquals('Normal', after.get(today.Id).Priority, 'A task due today is not overdue');
        System.assertEquals('Normal', after.get(undated.Id).Priority, 'A task with no ActivityDate is left alone');
        System.assertEquals('Normal', after.get(done.Id).Priority, 'Completed tasks are left alone');
    }

    @isTest
    static void handles200() {
        List<Task> tasks = new List<Task>();
        for (Integer i = 0; i < 250; i++) {
            tasks.add(new Task(Subject = 'T' + i, ActivityDate = Date.today().addDays(-1), Status = 'Not Started', Priority = 'Normal'));
        }
        insert tasks;
        Test.startTest();
        new SfcOverdueTaskJob().execute(null);
        Test.stopTest();
        System.assertEquals(250, [SELECT COUNT() FROM Task WHERE Priority = 'High']);
    }

    @isTest
    static void schedulesNightlyAndRuns() {
        Task late = new Task(Subject = 'Late', ActivityDate = Date.today().addDays(-1), Status = 'Not Started', Priority = 'Normal');
        insert late;
        Test.startTest();
        String jobId = SfcOverdueTaskJob.scheduleNightly();
        Test.stopTest();
        CronTrigger ct = [SELECT CronExpression, CronJobDetail.Name FROM CronTrigger WHERE Id = :jobId];
        System.assertEquals('0 0 2 * * ?', ct.CronExpression, 'Schedule it for 02:00 every day');
        System.assertEquals('SFCode overdue tasks', ct.CronJobDetail.Name);
        System.assertEquals('High', [SELECT Priority FROM Task WHERE Id = :late.Id].Priority, 'Test.stopTest runs the scheduled job');
    }
}
