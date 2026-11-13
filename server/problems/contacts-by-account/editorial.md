## Approach

Grouping is the most common collection pattern in Apex: one pass, a map from key to list.

For each contact, skip it if it's null or has no account, create the account's list the first time you see it, then add. `countByAccount` doesn't repeat the work: it calls `byAccount` and maps each list to its `size()`.

## Edge cases

A null argument returns an empty map rather than throwing. Contacts without an account aren't grouped under a `null` key, since nothing downstream expects one.

## Solution

**SfcContactIndex.cls**

```apex
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
```
