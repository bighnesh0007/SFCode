Accounts form a hierarchy through `ParentId` (a subsidiary's parent can have its
own parent, up to any depth). Reports need each account's **ultimate parent**.

Write the class `SfcAccountHierarchy` with:

```apex
public static Map<Id, Id> topParents(Set<Id> accountIds)
```

- For each Id in `accountIds`, return the Id of its top-most ancestor (the
  account with no parent above it).
- An account with **no parent is its own top parent**.
- Return an entry for every input Id. A `null` or empty set returns an empty map.
- Use **one query per level of the hierarchy**, not one per account: it must
  handle **200 accounts** in a hierarchy **5 levels deep** within the limits.
- Don't assume a maximum depth.
