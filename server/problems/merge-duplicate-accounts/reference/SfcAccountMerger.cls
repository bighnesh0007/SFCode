public with sharing class SfcAccountMerger {
    public static Integer mergeDuplicates(List<Account> accounts) {
        if (accounts == null || accounts.isEmpty()) return 0;
        Set<Id> ids = new Map<Id, Account>(accounts).keySet();
        Map<String, List<Account>> groups = new Map<String, List<Account>>();
        for (Account a : [SELECT Id, Name, CreatedDate FROM Account WHERE Id IN :ids ORDER BY CreatedDate, Id]) {
            String key = a.Name.trim().toLowerCase();
            if (!groups.containsKey(key)) groups.put(key, new List<Account>());
            groups.get(key).add(a);
        }
        Integer merged = 0;
        for (List<Account> g : groups.values()) {
            // Pass Ids only: merge saves every field loaded on the master, and CreatedDate is read-only.
            Account master = new Account(Id = g[0].Id);
            for (Integer i = 1; i < g.size(); i += 2) {
                List<Id> dupes = new List<Id>{ g[i].Id };
                if (i + 1 < g.size()) dupes.add(g[i + 1].Id);
                Database.merge(master, dupes);
                merged += dupes.size();
            }
        }
        return merged;
    }
}
