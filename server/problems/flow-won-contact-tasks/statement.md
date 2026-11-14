When a deal is won, the owner should thank **every contact** involved.
Build a record-triggered flow **in your connected org**:

| Setting | Value |
|---|---|
| Flow API Name | **`SFC_Won_Contact_Tasks`** |
| Object | Opportunity |
| Trigger | A record is **updated** |
| Optimize for | **Actions and Related Records** (after-save) |

When an opportunity's stage **changes to `Closed Won`**, create one **Task** for
each of its **opportunity contact roles**:

- `Subject`: **Send thank-you note**
- `WhoId`: the contact
- `WhatId`: the opportunity
- `OwnerId`: the opportunity's owner

A deal with no contact roles gets no tasks. It must work for a deal with **160
contacts** and when **many deals are won in one save**, so don't put Create
Records inside a loop.

**Activate** the flow, then click **Check my flow**.
