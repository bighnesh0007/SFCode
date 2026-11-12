public with sharing class SfcRevenueRollupHandler {
    public static void recalculate(Set<Id> accountIds) {
        if (accountIds.isEmpty()) {
            return;
        }
        Map<Id, Decimal> totals = new Map<Id, Decimal>();
        for (Id accountId : accountIds) {
            totals.put(accountId, 0);
        }
        for (AggregateResult r : [
            SELECT AccountId, SUM(Amount) total
            FROM Opportunity
            WHERE AccountId IN :accountIds AND StageName = 'Closed Won'
            GROUP BY AccountId
        ]) {
            Decimal total = (Decimal) r.get('total');
            totals.put((Id) r.get('AccountId'), total == null ? 0 : total);
        }
        List<Account> updates = new List<Account>();
        for (Id accountId : totals.keySet()) {
            updates.add(new Account(Id = accountId, AnnualRevenue = totals.get(accountId)));
        }
        update updates;
    }
}
