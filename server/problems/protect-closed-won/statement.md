Finance relies on won deals staying in the system.

Write the trigger `SfcProtectClosedWon` on **Opportunity** that **blocks deleting**
any opportunity whose `StageName` is `Closed Won`, with the error message:

> Closed Won opportunities cannot be deleted.

Other opportunities must delete normally — including when a won and a non-won
opportunity are deleted **in the same call** with partial success
(`Database.delete(records, false)`): only the won one may fail.
