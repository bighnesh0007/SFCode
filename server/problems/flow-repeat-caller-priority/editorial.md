## Build it

1. Record-Triggered Flow on **Case**, **A record is created**, optimized for **Fast Field Updates**.
2. Entry condition: `ContactId` **Is Null** `false`.
3. **Get Records**: `Case` where `ContactId` = `{!$Record.ContactId}` **AND** `IsClosed` = `false`, **only the first record**.
4. **Decision**: is the found case **not null**?
5. On that outcome, **Assignment**: `{!$Record.Priority}` = `High`.
6. Save as **SFC_Repeat_Caller_Priority** and **Activate**.

## The key idea

Before-save flows can't create or update *other* records, but they **can read** them with Get Records, and they change the triggering record just by assigning to `$Record`, with no DML. The record isn't in the database yet, so the query can't find itself. When 200 cases arrive together, the platform runs the Get Records for all of them in bulk.
