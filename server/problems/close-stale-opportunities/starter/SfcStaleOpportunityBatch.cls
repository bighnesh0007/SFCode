public with sharing class SfcStaleOpportunityBatch implements Database.Batchable<SObject> {
    public Database.QueryLocator start(Database.BatchableContext bc) {
        // Your code here
        return null;
    }

    public void execute(Database.BatchableContext bc, List<Opportunity> scope) {
        // Your code here
    }

    public void finish(Database.BatchableContext bc) {
    }
}
