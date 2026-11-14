## Approach

Callouts aren't allowed from triggers (the transaction holds uncommitted DML). The standard pattern:

1. The trigger only **decides**: which records just became Closed Won.
2. It enqueues **one** Queueable for all of them. One job per record would exhaust the 50-jobs-per-transaction limit in a bulk update.
3. The job (`Database.AllowsCallouts`) runs in its own transaction: query, call out **first**, then write the result back in one DML.

Writing the outcome back (`NextStep` here; a status field in real life) makes failures visible and retryable.

## Solution

```apex
trigger SfcOpportunityErpSync on Opportunity (after update) {
    Set<Id> won = new Set<Id>();
    for (Opportunity o : Trigger.new) {
        if (o.StageName == 'Closed Won' && Trigger.oldMap.get(o.Id).StageName != 'Closed Won') won.add(o.Id);
    }
    if (!won.isEmpty()) System.enqueueJob(new SfcErpSyncJob(won));
}
```

```apex
public with sharing class SfcErpSyncJob implements Queueable, Database.AllowsCallouts {
    private final Set<Id> opportunityIds;

    public SfcErpSyncJob(Set<Id> opportunityIds) {
        this.opportunityIds = opportunityIds;
    }

    public void execute(QueueableContext ctx) {
        List<Opportunity> opps = [SELECT Id, Name, Amount FROM Opportunity WHERE Id IN :opportunityIds];
        List<Map<String, Object>> orders = new List<Map<String, Object>>();
        for (Opportunity o : opps) orders.add(new Map<String, Object>{ 'id' => o.Id, 'name' => o.Name, 'amount' => o.Amount });

        HttpRequest req = new HttpRequest();
        req.setMethod('POST');
        req.setEndpoint('https://erp.example.com/orders');
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(orders));
        HttpResponse res = new Http().send(req);

        String outcome = res.getStatusCode() == 201 ? 'Sent to ERP' : 'ERP sync failed';
        for (Opportunity o : opps) o.NextStep = outcome;
        update opps;
    }
}
```
