Keep each Account's `AnnualRevenue` equal to the **sum of `Amount` over its
`Closed Won` opportunities**. An account with no won opportunities has
`AnnualRevenue = 0`.

The value must stay correct when an opportunity is **inserted, updated, deleted
or undeleted** — including when its `StageName`, its `Amount`, or its
**`AccountId` changes** (both the old and the new account must be recalculated).

Put the logic in `SfcRevenueRollupHandler` and keep the trigger
`SfcRevenueRollup` thin. It must handle 200 opportunities in one DML statement
without hitting governor limits.

*Hint:* an aggregate query (`SUM(Amount) … GROUP BY AccountId`) recalculates every
affected account in one SOQL statement.
