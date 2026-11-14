trigger SfcOpportunityErpSync on Opportunity (after update) {
    Set<Id> won = new Set<Id>();
    for (Opportunity o : Trigger.new) {
        if (o.StageName == 'Closed Won' && Trigger.oldMap.get(o.Id).StageName != 'Closed Won') won.add(o.Id);
    }
    if (!won.isEmpty()) System.enqueueJob(new SfcErpSyncJob(won));
}
