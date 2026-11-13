Write a **Schedulable** class `SfcOverdueTaskJob` that an admin can schedule to run every night.

When it runs, every **open** Task (`IsClosed = false`) whose `ActivityDate` is **before today**
gets its `Priority` set to **High**, so it stands out on everyone's list.

- Tasks due today or later, tasks with no `ActivityDate`, and completed tasks are left alone.
- It must handle hundreds of tasks in one run.

Also add a static helper that schedules it:

```apex
public static String scheduleNightly()
```

It calls `System.schedule('SFCode overdue tasks', '0 0 2 * * ?', new SfcOverdueTaskJob())`
(02:00 every day) and returns the job id.
