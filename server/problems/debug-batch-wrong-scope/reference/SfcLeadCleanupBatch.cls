public with sharing class SfcLeadCleanupBatch implements Database.Batchable<SObject> {
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator([
            SELECT Id, Rating FROM Lead WHERE Status = 'Open - Not Contacted' AND LeadSource = 'Web'
        ]);
    }

    public void execute(Database.BatchableContext bc, List<Lead> scope) {
        // The scope already holds the records: change them and save them once.
        for (Lead l : scope) {
            l.Rating = 'Cold';
        }
        update scope;
    }

    public void finish(Database.BatchableContext bc) {
    }
}
