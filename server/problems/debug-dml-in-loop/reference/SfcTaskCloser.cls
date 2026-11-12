public with sharing class SfcTaskCloser {
    public static void closeAll(List<Task> tasks) {
        if (tasks == null || tasks.isEmpty()) {
            return;
        }
        for (Task t : tasks) {
            t.Status = 'Completed';
        }
        // One DML statement for the whole list, however long it is.
        update tasks;
    }
}
