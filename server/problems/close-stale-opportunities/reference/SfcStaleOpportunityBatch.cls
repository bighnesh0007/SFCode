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
