public with sharing class SfcRatingBatch implements Database.Batchable<SObject>, Database.Stateful {
    public Integer ratedHot = 0;

    public Database.QueryLocator start(Database.BatchableContext ctx) {
        return Database.getQueryLocator([SELECT Id, AnnualRevenue FROM Account]);
    }

    public void execute(Database.BatchableContext ctx, List<Account> scope) {
        List<Account> hot = new List<Account>();
        for (Account a : scope) {
            if (a.AnnualRevenue != null && a.AnnualRevenue > 1000000) {
                a.Rating = 'Hot';
                hot.add(a);
            }
        }
        update hot;
        ratedHot += hot.size();
    }

    public void finish(Database.BatchableContext ctx) {
        insert new Task(Subject = 'Rating batch: ' + ratedHot + ' accounts rated Hot', Status = 'Completed', Priority = 'Normal');
    }
}
