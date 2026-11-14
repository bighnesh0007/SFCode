Finance has closed its books on won and lost deals. Stop anyone changing the
amount of a closed opportunity, **without code**. Build a record-triggered flow
**in your connected org**:

| Setting | Value |
|---|---|
| Flow API Name | **`SFC_Lock_Closed_Amount`** |
| Object | Opportunity |
| Trigger | A record is **updated** |
| Optimize for | **Fast Field Updates** (before-save) |

If the opportunity **was already closed before this save** and its `Amount`
**changed**, block the save with the error message
**Closed deals can't change amount.**

- Closing a deal and setting its amount in the same save is allowed.
- Other edits to closed deals (for example `Description`) are allowed.

**Activate** the flow, then click **Check my flow**.
