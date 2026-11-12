Build this **in your connected org**, without code: a record-triggered flow.

| Setting | Value |
|---|---|
| Flow API Name | **`SFC_Account_Default_Rating`** |
| Object | Account |
| Trigger | A record is **created** |
| Optimize for | **Fast Field Updates** (before-save) |

When a new account's `Industry` is **Technology** and its `Rating` is **blank**,
set `Rating` to **Hot**. Leave every other account alone, and never overwrite a
rating the user chose.

**Activate** the flow, then click **Check my flow**. Hidden tests insert
accounts (including 200 at once) and verify the result.
