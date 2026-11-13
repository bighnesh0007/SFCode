public with sharing class SfcOverdueTaskJob implements Schedulable {
    public void execute(SchedulableContext context) {
        List<Task> overdue = [SELECT Id FROM Task WHERE IsClosed = false AND ActivityDate < TODAY];
        for (Task t : overdue) {
            t.Priority = 'High';
        }
        update overdue;
    }

    public static String scheduleNightly() {
        return System.schedule('SFCode overdue tasks', '0 0 2 * * ?', new SfcOverdueTaskJob());
    }
}
