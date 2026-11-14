A customer who contacts support again while an earlier case is still open is
frustrated. Raise the new case's priority automatically. Build a record-triggered
flow **in your connected org**:

| Setting | Value |
|---|---|
| Flow API Name | **`SFC_Repeat_Caller_Priority`** |
| Object | Case |
| Trigger | A record is **created** |
| Optimize for | **Fast Field Updates** (before-save) |

When a new case's contact (`ContactId`) already has **another open case**
(`IsClosed` false), set the new case's `Priority` to **High**.

- Cases without a contact are left alone.
- A contact whose earlier cases are all **closed** is not a repeat caller.
- It must work when many cases are created at once.

**Activate** the flow, then click **Check my flow**.
