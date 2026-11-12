Whenever an Account is **updated**, its `Description` should be set to
`Reviewed`. Since this trigger was deployed, editing any account fails with:

> maximum trigger depth exceeded

**Fix `SfcAccountStamp`** so that updating accounts — one or 200 at a time —
sets `Description` to `Reviewed` with **no extra DML** and no recursion.

*Hint:* does this trigger need to run *after* the update at all?
