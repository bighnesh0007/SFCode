When an account moves, its contacts' mailing city should follow — but
asynchronously, so the user saving the account isn't kept waiting.

Write `SfcContactCitySync`, a class that implements **`Queueable`**:

- its constructor takes a `Set<Id>` of Account Ids;
- `execute` sets every Contact's `MailingCity` to its Account's `BillingCity`,
  for the given accounts only;
- contacts of other accounts are not touched.

It is enqueued with `System.enqueueJob(new SfcContactCitySync(accountIds))`.
