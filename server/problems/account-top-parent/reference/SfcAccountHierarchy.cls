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
