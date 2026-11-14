When deals are won, the ERP needs an order for each one. Triggers can't make
callouts, so hand the work to an asynchronous job.

**Trigger** `SfcOpportunityErpSync` (after update on Opportunity): collect the
opportunities whose `StageName` **changed to** `Closed Won` and enqueue **one**
`SfcErpSyncJob` for all of them (not one job per record). If none changed, enqueue nothing.

**Class** `SfcErpSyncJob implements Queueable, Database.AllowsCallouts`, with a
constructor taking `Set<Id> opportunityIds`. Its `execute`:

- sends **one** `POST` to `https://erp.example.com/orders` with header
  `Content-Type: application/json` and a JSON array body:
  `[{"id": "006...", "name": "Big Deal", "amount": 5000}]`
- on status **201**, sets `NextStep` to **Sent to ERP** on those opportunities;
- on any other status, sets `NextStep` to **ERP sync failed**.
