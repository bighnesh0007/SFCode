## Approach

1. **Normalise the key**: `name.trim().toLowerCase()`, so spacing and case don't hide duplicates.
2. **Re-query** with `ORDER BY CreatedDate, Id`, so the first account in each group is the survivor and ties are broken predictably.
3. **Merge by Id**: pass the master as `new Account(Id = ...)` and the duplicates as Ids. `merge` saves every field loaded on the master record, so passing the queried record (with read-only `CreatedDate`) fails.
4. **Merge in slices of two**: `Database.merge` accepts a master and up to two duplicates. Merging moves child records (contacts, opportunities, activities) to the master and deletes the duplicates.

Each `merge` call is a DML statement, so a huge batch of groups would need Batch Apex; for an import clean-up of a few dozen groups this runs in one transaction.

## Solution

```apex
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
```
