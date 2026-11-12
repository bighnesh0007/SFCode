`SfcTaskCloser.closeAll(tasks)` marks a list of Tasks as **Completed**. It works when a support agent closes a handful, but the nightly cleanup job that closes a few hundred at once fails with:

```
System.LimitException: Too many DML statements: 151
```

Fix **`SfcTaskCloser`** so that:

- every task passed in ends up with `Status = 'Completed'`,
- it works for **200+** tasks in one call,
- a `null` or empty list does nothing (and uses no DML).

Keep the class name and the method signature `public static void closeAll(List<Task> tasks)`.
