## Approach

Two kinds of duplicate, one data structure:

1. **Collect** the batch's emails, lower-cased, into a set.
2. **Query once** for existing contacts with those emails, and seed a `taken` set with them, lower-cased. SOQL compares email values case-insensitively, so lower-case binds still match `Ada@Example.com`.
3. **Walk the batch in order.** If an email is already in `taken`, refuse it. Otherwise add it, which makes the *first* occurrence win and every later one in the same insert fail.

`addError` on a record in a before trigger stops just that record. With `Database.insert(list, false)` the others still save.

## Why not a duplicate rule?

Duplicate and matching rules are the declarative answer, and in a real org you'd try them first. This problem is about the bulk pattern: one query, sets, and a single ordered pass.

## Solution

```apex
trigger SfcContactDedupe on Contact (before insert) {
    Set<String> incoming = new Set<String>();
    for (Contact c : Trigger.new) {
        if (c.Email != null) {
            incoming.add(c.Email.toLowerCase());
        }
    }
    if (incoming.isEmpty()) {
        return;
    }
    Set<String> taken = new Set<String>();
    for (Contact existing : [SELECT Email FROM Contact WHERE Email IN :incoming]) {
        taken.add(existing.Email.toLowerCase());
    }
    for (Contact c : Trigger.new) {
        if (c.Email == null) {
            continue;
        }
        String key = c.Email.toLowerCase();
        if (taken.contains(key)) {
            c.addError('A contact with this email already exists.');
        } else {
            taken.add(key);
        }
    }
}
```
