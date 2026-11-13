## Build it

1. Record-Triggered Flow on **Account**, trigger **A record is updated**.
2. Condition: `AnnualRevenue` **Greater Than** `1000000`.
3. **When to run the flow:** *Only when a record is updated to meet the condition requirements.* This is what stops a second task when revenue goes from 2M to 3M.
4. Optimize for **Actions and Related Records** (after-save).
5. **Create Records**: one Task with
   - `Subject` = `Review key account`
   - `WhatId` = `{!$Record.Id}`
   - `OwnerId` = `{!$Record.OwnerId}`
6. Save as **SFC_Key_Account_Review** and **Activate**.

## The key idea

"Every time the condition is met" fires on every save while revenue stays high. "Only when updated to meet" fires once, on the change. Picking the right one is most of this problem.
