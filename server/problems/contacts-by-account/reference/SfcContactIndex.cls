public with sharing class SfcContactIndex {
    public static Map<Id, List<Contact>> byAccount(List<Contact> contacts) {
        Map<Id, List<Contact>> groups = new Map<Id, List<Contact>>();
        if (contacts == null) {
            return groups;
        }
        for (Contact c : contacts) {
            if (c == null || c.AccountId == null) {
                continue;
            }
            if (!groups.containsKey(c.AccountId)) {
                groups.put(c.AccountId, new List<Contact>());
            }
            groups.get(c.AccountId).add(c);
        }
        return groups;
    }

    public static Map<Id, Integer> countByAccount(List<Contact> contacts) {
        Map<Id, Integer> counts = new Map<Id, Integer>();
        Map<Id, List<Contact>> groups = byAccount(contacts);
        for (Id accountId : groups.keySet()) {
            counts.put(accountId, groups.get(accountId).size());
        }
        return counts;
    }
}
