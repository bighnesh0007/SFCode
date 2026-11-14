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
