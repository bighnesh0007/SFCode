`SfcRatingBatch` rates accounts: those with `AnnualRevenue` over 1,000,000 get
`Rating` **Hot**. When it finishes, it logs a summary Task with the subject
**Rating batch: N accounts rated Hot**.

The ratings are applied, but the summary always says **0 accounts**.

Fix `SfcRatingBatch` so the summary reports how many accounts it rated Hot
across the **whole run**. Keep the class name, the counter field and the
Task subject format.
