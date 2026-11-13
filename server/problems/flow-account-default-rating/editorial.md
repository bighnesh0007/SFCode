## Build it

1. **Setup → Flows → New Flow → Record-Triggered Flow.**
2. Object **Account**, trigger **A record is created**.
3. Entry conditions, **All Conditions Are Met (AND)**:
   - `Industry` **Equals** `Technology`
   - `Rating` **Is Null** `True`
4. Optimize for **Fast Field Updates**.
5. Add **Update Records → Update the record that triggered the flow**: set `Rating` = `Hot`.
6. Save as **SFC_Account_Default_Rating** and **Activate**.

## Why before-save?

Fast Field Updates run before the record is written, so updating the triggering record costs no DML and runs much faster than an after-save flow. The entry condition on a blank Rating means a value the user chose is never overwritten.
