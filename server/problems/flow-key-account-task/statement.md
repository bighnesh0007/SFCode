When an account becomes a key account, its owner should get a review task.
Build a record-triggered flow **in your connected org**:

| Setting | Value |
|---|---|
| Flow API Name | **`SFC_Key_Account_Review`** |
| Object | Account |
| Trigger | A record is **updated** |
| Optimize for | **Actions and Related Records** (after-save) |

When an account's `AnnualRevenue` is **greater than 1,000,000**, create a
**Task** with:

- `Subject`: **Review key account**
- `WhatId`: the account
- `OwnerId`: the account's owner

Only create it **when the account changes to meet the condition**. Raising
revenue from 2M to 3M must not create a second task.

**Activate** the flow, then click **Check my flow**.
