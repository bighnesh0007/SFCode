## Build it

1. Record-Triggered Flow on **Opportunity**, **A record is updated**, **Actions and Related Records**.
2. Condition `StageName` **Equals** `Closed Won`, **only when updated to meet the condition requirements**.
3. **Get Records**: `OpportunityContactRole` where `OpportunityId` = `{!$Record.Id}`, all records.
4. **Loop** over the roles. Inside it, an **Assignment** that sets a single Task variable:
   `Subject` = `Send thank-you note`, `WhoId` = `{!Role.ContactId}`, `WhatId` = `{!$Record.Id}`, `OwnerId` = `{!$Record.OwnerId}`,
   then **Add** it to a Task collection variable.
5. **After** the loop, **Create Records** from the collection (skip it with a Decision if the collection is empty).
6. Save as **SFC_Won_Contact_Tasks** and **Activate**.

## The key idea

When many records trigger a flow, the platform batches the same element across their interviews, but **inside a loop each pass is a separate DML statement**. A Create Records in the loop therefore runs once per contact: a deal with more than 150 contact roles exceeds the 150-statement limit and the whole save fails. Build a collection in the loop and create it once, after the loop.
