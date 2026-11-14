When an account turns **Hot**, sales wants every one of its open deals flagged.
Build a record-triggered flow **in your connected org**:

| Setting | Value |
|---|---|
| Flow API Name | **`SFC_Hot_Account_Opps`** |
| Object | Account |
| Trigger | A record is **updated** |
| Optimize for | **Actions and Related Records** (after-save) |

When an account's `Rating` **changes to `Hot`**, update all of its **open**
opportunities (`IsClosed` is false): set `NextStep` to **Call this week**.

- Closed opportunities (won or lost) are left alone.
- Other accounts' opportunities are left alone.
- Saving an account that is already Hot must not run it again.

**Activate** the flow, then click **Check my flow**.
