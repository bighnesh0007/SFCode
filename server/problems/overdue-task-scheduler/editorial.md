## Approach

**Schedulable** classes run at times given by a cron expression. `execute` is the whole job:

1. One query for open tasks due before today. `IsClosed` covers every closed status, and `ActivityDate < TODAY` excludes tasks with no date automatically, because null never compares as less than a date.
2. Set `Priority` in memory, then one `update`.

`System.schedule(name, cron, instance)` registers the job and returns the CronTrigger id. In the cron expression `0 0 2 * * ?` the fields are seconds, minutes, hours, day of month, month and day of week: 02:00:00 every day.

## Testing

Inside `Test.startTest()` / `Test.stopTest()`, a scheduled job runs **at `stopTest`**, so the test can check both the CronTrigger and the effect.

## Bigger volumes

A scheduled job has the normal synchronous limits (10,000 DML rows). For more, have `execute` start a Batch class instead: `Database.executeBatch(new MyBatch())`.

## Solution

```apex
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
```
