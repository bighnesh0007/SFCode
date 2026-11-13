## Approach

A batch class implements `Database.Batchable<SObject>`. `start` returns a **QueryLocator**, which can walk up to 50 million records, and Salesforce feeds them to `execute` in chunks (200 by default). Each chunk gets fresh governor limits.

- **start:** open opportunities whose close date has passed: `IsClosed = false AND CloseDate < TODAY`. `IsClosed` is safer than listing stage names, because orgs rename stages.
- **execute:** set the stage on every record, then do **one** `update scope`.
- **finish:** nothing is required here. It's where you'd send a summary email or chain another job.

## Pitfall

Don't query again inside `execute`: the scope already holds the records you need.

## Solution

**SfcStaleOpportunityBatch.cls**

```apex
public with sharing class SfcStaleOpportunityBatch implements Database.Batchable<SObject> {
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator([
            SELECT Id FROM Opportunity WHERE IsClosed = false AND CloseDate < TODAY
        ]);
    }

    public void execute(Database.BatchableContext bc, List<Opportunity> scope) {
        for (Opportunity o : scope) {
            o.StageName = 'Closed Lost';
        }
        update scope;
    }

    public void finish(Database.BatchableContext bc) {
    }
}
```
