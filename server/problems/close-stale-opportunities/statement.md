Pipelines fill up with deals nobody closed. Write a **Batch Apex** class
`SfcStaleOpportunityBatch` that implements `Database.Batchable<SObject>` and:

- selects every **open** opportunity (`IsClosed = false`) whose `CloseDate` is
  **before today**;
- sets its `StageName` to `Closed Lost`;
- leaves closed opportunities and ones dated today or later untouched.

It must work when run as `Database.executeBatch(new SfcStaleOpportunityBatch(), 200)`
over hundreds of records.
