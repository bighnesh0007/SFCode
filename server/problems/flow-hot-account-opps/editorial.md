## Build it

1. Record-Triggered Flow on **Account**, **A record is updated**, optimized for **Actions and Related Records**.
2. Condition `Rating` **Equals** `Hot`, run **only when a record is updated to meet the condition requirements**.
3. **Update Records** → *Specify conditions to identify records*:
   - Object **Opportunity**, filter `AccountId` Equals `{!$Record.Id}` **AND** `IsClosed` Equals `false`
   - Set `NextStep` = `Call this week`
4. Save as **SFC_Hot_Account_Opps** and **Activate**.

## The key idea

You don't need Get Records plus a Loop to change related records. Update Records with conditions updates every matching record in **one** DML statement, which is faster and bulk-safe.
