## Build it

1. Record-Triggered Flow on **Opportunity**, trigger **A record is created or updated**.
2. Condition: `StageName` **Equals** `Closed Won`.
3. Optimize for **Fast Field Updates**.
4. **Update Records → the record that triggered the flow**: `NextStep` = `Hand off to onboarding`.
5. Save as **SFC_Opportunity_Won_Next_Step** and **Activate**.

## Notes

The text must match exactly: the tests compare strings. Leaving "When to run" as *every time the condition is met* is fine here, because writing the same value again changes nothing.
