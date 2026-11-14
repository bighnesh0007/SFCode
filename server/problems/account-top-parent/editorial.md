## Approach

Walk **up the tree one level at a time for all accounts together**:

1. `reached` maps each start Id to the ancestor reached so far (initially itself).
2. Each round, query `Id, ParentId` for the distinct ancestors still being climbed, in **one** query.
3. Any ancestor with a parent moves up; ancestors without one are done.
4. Repeat until nothing moves.

This uses as many queries as the deepest hierarchy has levels, so 200 accounts five levels deep take about five queries. Querying per account would take 200+ and fail.

## Solution

```apex
public with sharing class SfcAccountHierarchy {
    public static Map<Id, Id> topParents(Set<Id> accountIds) {
        Map<Id, Id> reached = new Map<Id, Id>();
        if (accountIds == null || accountIds.isEmpty()) return reached;
        for (Id id : accountIds) reached.put(id, id);
        Set<Id> climbing = new Set<Id>(accountIds);
        while (!climbing.isEmpty()) {
            Map<Id, Id> parentOf = new Map<Id, Id>();
            for (Account a : [SELECT Id, ParentId FROM Account WHERE Id IN :climbing]) {
                if (a.ParentId != null) parentOf.put(a.Id, a.ParentId);
            }
            Set<Id> next = new Set<Id>();
            for (Id start : reached.keySet()) {
                Id parent = parentOf.get(reached.get(start));
                if (parent != null) {
                    reached.put(start, parent);
                    next.add(parent);
                }
            }
            climbing = next;
        }
        return reached;
    }
}
```

**Why `climbing` shrinks:** only ancestors that just moved up can move again, so finished branches drop out of the query.
