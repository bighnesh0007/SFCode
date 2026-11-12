Grouping records by a parent Id is something you'll write in nearly every trigger. Build the helper once, properly.

Write a class **`SfcContactIndex`** with two `public static` methods:

### `Map<Id, List<Contact>> byAccount(List<Contact> contacts)`

- One map entry per `AccountId`, holding that account's contacts **in the order they appear in the input**.
- Skip contacts with **no `AccountId`**, and skip `null` list elements.
- A `null` or empty input returns an **empty map**, never `null`.

### `Map<Id, Integer> countByAccount(List<Contact> contacts)`

- How many contacts each account has, by the same rules.

```apex
// a1 has Ann and Bob, a2 has Cy; Dee has no account
SfcContactIndex.byAccount(contacts).get(a1)      // (Ann, Bob)
SfcContactIndex.countByAccount(contacts).get(a2) // 1
```

> The tests don't insert records, so no DML or SOQL is needed.
