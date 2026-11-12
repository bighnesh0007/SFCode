Build a record-triggered flow **in your connected org**:

| Setting | Value |
|---|---|
| Flow API Name | **`SFC_Opportunity_Won_Next_Step`** |
| Object | Opportunity |
| Trigger | A record is **created or updated** |
| Optimize for | **Fast Field Updates** |

Whenever an opportunity's `StageName` is **Closed Won**, set its `NextStep`
to exactly:

> Hand off to onboarding

This applies both to opportunities created as Closed Won and to ones updated
to Closed Won later. Other opportunities keep their `NextStep`.

**Activate** the flow, then click **Check my flow**.
