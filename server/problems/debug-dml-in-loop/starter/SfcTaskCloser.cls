public with sharing class SfcTaskCloser {
    public static void closeAll(List<Task> tasks) {
        if (tasks == null) {
            return;
        }
        for (Task t : tasks) {
            t.Status = 'Completed';
            update t;
        }
    }
}
