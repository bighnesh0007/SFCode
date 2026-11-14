`SfcLeadScorer.score(List<Lead>)` is called from a **before insert/update**
trigger on Lead. It sets `Rating` to **Hot** for leads with `AnnualRevenue` over
1,000,000, otherwise **Warm**.

To stop it running twice, a developer added a static `Boolean` guard. It worked
in testing, but when marketing imported **400 leads** with Data Loader, only the
**first 200** got a rating.

Fix `SfcLeadScorer` so every lead is scored, however many are saved at once,
while still never scoring the **same lead** twice in one transaction.

> The trigger `SfcLeadScoreTrigger` is already written and just calls
> `SfcLeadScorer.score(Trigger.new)`. The bug is in the class. Keep the method's signature.
